"""Build a true-3D multifiber yarn patch and render internal reference frames.

This consumes only the independently generated metric centerlines. It does not
load or execute Fibric/LYNX assets. The result is an internal geometry/render
probe, not an accepted reproduction of the missing official pattern.
"""
from __future__ import annotations

import argparse
import json
import math
import random
from pathlib import Path

import bpy
from mathutils import Vector


def arguments() -> argparse.Namespace:
    argv = []
    if "--" in __import__("sys").argv:
        argv = __import__("sys").argv[__import__("sys").argv.index("--") + 1 :]
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--samples", type=int, default=64)
    return parser.parse_args(argv)


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)


def set_socket(node, names, value) -> bool:
    for name in names:
        socket = node.inputs.get(name)
        if socket is not None:
            socket.default_value = value
            return True
    return False


def make_fiber_material(name: str, color: tuple[float, float, float, float], roughness: float):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    shader_mode = "principled_hair"
    try:
        shader = nodes.new("ShaderNodeBsdfHairPrincipled")
        for mode in ("DIRECT", "COLOR"):
            try:
                shader.parametrization = mode
                break
            except Exception:
                continue
        set_socket(shader, ["Color"], color)
        set_socket(shader, ["Roughness"], roughness)
        set_socket(shader, ["Radial Roughness"], min(1.0, roughness + 0.08))
        set_socket(shader, ["IOR"], 1.46)
        links.new(shader.outputs[0], output.inputs["Surface"])
    except Exception:
        shader_mode = "principled_surface_fallback"
        shader = nodes.new("ShaderNodeBsdfPrincipled")
        set_socket(shader, ["Base Color"], color)
        set_socket(shader, ["Roughness"], roughness)
        set_socket(shader, ["IOR"], 1.46)
        set_socket(shader, ["Anisotropic IOR Level", "Anisotropic"], 0.65)
        set_socket(shader, ["Sheen Weight", "Sheen"], 0.18)
        geometry = nodes.new("ShaderNodeNewGeometry")
        tangent_input = shader.inputs.get("Tangent")
        tangent_output = geometry.outputs.get("Tangent")
        if tangent_input is not None and tangent_output is not None:
            links.new(tangent_output, tangent_input)
        links.new(shader.outputs[0], output.inputs["Surface"])
    return material, shader_mode


def tangent_at(points: list[Vector], index: int) -> Vector:
    before = points[max(0, index - 1)]
    after = points[min(len(points) - 1, index + 1)]
    tangent = after - before
    if tangent.length < 1e-12:
        raise ValueError(f"zero tangent at point {index}")
    return tangent.normalized()


def frame_for_tangent(tangent: Vector) -> tuple[Vector, Vector]:
    reference = Vector((0.0, 0.0, 1.0))
    if abs(tangent.dot(reference)) > 0.93:
        reference = Vector((1.0, 0.0, 0.0))
    normal = tangent.cross(reference)
    if normal.length < 1e-12:
        reference = Vector((0.0, 1.0, 0.0))
        normal = tangent.cross(reference)
    normal.normalize()
    binormal = tangent.cross(normal).normalized()
    return normal, binormal


def make_curve_object(name: str, splines: list[list[Vector]], bevel_depth: float, material, bevel_resolution: int = 2):
    data = bpy.data.curves.new(name, type="CURVE")
    data.dimensions = "3D"
    data.resolution_u = 1
    data.render_resolution_u = 1
    data.bevel_depth = bevel_depth
    data.bevel_resolution = bevel_resolution
    data.fill_mode = "FULL"
    for values in splines:
        spline = data.splines.new("POLY")
        spline.points.add(len(values) - 1)
        for point, value in zip(spline.points, values):
            point.co = (value.x, value.y, value.z, 1.0)
        spline.use_cyclic_u = False
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    return obj


def create_yarn_splines(payload: dict):
    recipe = payload["renderRecipe"]
    ply_count = int(recipe["plyCount"])
    orbit = float(recipe["plyOrbitRadiusM"])
    twist_pitch = float(recipe["twistPitchM"])
    families = {"warp": [], "weft": []}
    source_curves = []
    for curve in payload["curves"]:
        center = [Vector(tuple(point)) for point in curve["points"]]
        if len(center) < 2:
            raise ValueError(f"{curve['id']} has fewer than two points")
        source_curves.append((curve, center))
        arc = [0.0]
        for index in range(1, len(center)):
            arc.append(arc[-1] + (center[index] - center[index - 1]).length)
        for ply in range(ply_count):
            values = []
            phase_offset = 2.0 * math.pi * ply / ply_count
            for index, position in enumerate(center):
                tangent = tangent_at(center, index)
                normal, binormal = frame_for_tangent(tangent)
                phase = 2.0 * math.pi * arc[index] / twist_pitch + phase_offset
                offset = orbit * (math.cos(phase) * normal + math.sin(phase) * binormal)
                values.append(position + offset)
            families[curve["family"]].append(values)
    return families, source_curves


def create_fuzz(source_curves, payload: dict, material):
    recipe = payload["renderRecipe"]
    rng = random.Random(int(recipe["seed"]))
    fuzz = []
    count = int(recipe["fuzzCount"])
    for _ in range(count):
        curve, points = source_curves[rng.randrange(len(source_curves))]
        index = rng.randrange(1, len(points) - 1)
        anchor = points[index]
        tangent = tangent_at(points, index)
        normal, binormal = frame_for_tangent(tangent)
        angle = rng.random() * math.tau
        radial = math.cos(angle) * normal + math.sin(angle) * binormal
        along = tangent * rng.uniform(-0.25, 0.25)
        direction = (radial * rng.uniform(0.7, 1.0) + along).normalized()
        length = rng.uniform(0.00045, 0.0017)
        root = anchor + radial * rng.uniform(0.00008, 0.00016)
        bend = binormal * rng.uniform(-0.00015, 0.00015)
        fuzz.append([root, root + direction * (length * 0.55) + bend, root + direction * length + 2.0 * bend])
    return make_curve_object("Fuzz", fuzz, float(recipe["fuzzRadiusM"]), material, bevel_resolution=1)


def add_ground(width: float, height: float):
    bpy.ops.mesh.primitive_plane_add(size=max(width, height) * 4.0, location=(width * 0.5, height * 0.5, -0.0038))
    ground = bpy.context.object
    ground.name = "NeutralGround"
    material = bpy.data.materials.new("NeutralGroundMaterial")
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        set_socket(bsdf, ["Base Color"], (0.008, 0.010, 0.014, 1.0))
        set_socket(bsdf, ["Roughness"], 0.34)
        set_socket(bsdf, ["Specular IOR Level", "Specular"], 0.4)
    ground.data.materials.append(material)


def look_at(obj, target: Vector):
    obj.rotation_euler = (target - obj.location).to_track_quat("-Z", "Y").to_euler()


def add_area(name: str, location, target, energy: float, size: float, color):
    data = bpy.data.lights.new(name, type="AREA")
    data.energy = energy
    data.shape = "DISK"
    data.size = size
    data.color = color
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.location = location
    look_at(obj, target)
    return obj


def configure_scene(payload: dict, samples: int):
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    if hasattr(scene, "cycles"):
        try:
            scene.render.engine = "CYCLES"
            scene.cycles.device = "CPU"
            scene.cycles.samples = samples
            scene.cycles.use_adaptive_sampling = True
            scene.cycles.adaptive_threshold = 0.02
            scene.cycles.use_denoising = False
            scene.cycles.max_bounces = 8
            scene.cycles.diffuse_bounces = 3
            scene.cycles.glossy_bounces = 4
            scene.cycles.transmission_bounces = 6
        except Exception:
            scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 720
    scene.render.resolution_y = 720
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.render.image_settings.color_mode = "RGBA"
    if hasattr(scene.render.image_settings, "color_depth"):
        scene.render.image_settings.color_depth = "16"
    for transform in ("AgX", "Filmic"):
        try:
            scene.view_settings.view_transform = transform
            break
        except Exception:
            continue
    world = bpy.data.worlds.new("World") if bpy.data.worlds.get("World") is None else bpy.data.worlds["World"]
    scene.world = world
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.004, 0.006, 0.010, 1.0)
    background.inputs["Strength"].default_value = 0.18

    width, height = map(float, payload["tileSizeM"])
    target = Vector((width * 0.5, height * 0.5, 0.0015))
    add_area("WarmKey", Vector((-0.022, -0.018, 0.038)), target, 750.0, 0.035, (1.0, 0.55, 0.28))
    add_area("CoolRim", Vector((width + 0.025, height + 0.018, 0.028)), target, 900.0, 0.028, (0.32, 0.48, 1.0))
    add_area("SoftFill", Vector((width * 0.5, height * 0.2, 0.065)), target, 420.0, 0.050, (0.74, 0.86, 1.0))
    return target


def make_camera(name: str, location: Vector, target: Vector, lens: float):
    data = bpy.data.cameras.new(name)
    data.lens = lens
    data.sensor_width = 36.0
    data.dof.use_dof = True
    data.dof.focus_distance = (location - target).length
    data.dof.aperture_fstop = 5.6
    camera = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(camera)
    camera.location = location
    look_at(camera, target)
    return camera


def render_views(payload: dict, out: Path, target: Vector):
    scene = bpy.context.scene
    width, height = map(float, payload["tileSizeM"])
    views = {
        "macro": (Vector((width * 0.5, height * 0.5, 0.052)), 78.0),
        "grazing": (Vector((width * 1.02, -height * 0.72, 0.023)), 72.0),
    }
    for name, (location, lens) in views.items():
        camera = make_camera(f"Camera_{name}", location, target, lens)
        scene.camera = camera
        scene.render.filepath = str(out / f"{name}.png")
        bpy.ops.render.render(write_still=True)


def main() -> None:
    args = arguments()
    args.out.mkdir(parents=True, exist_ok=True)
    payload = json.loads(args.input.read_text())
    if payload.get("authority") != "algorithm_fixture_not_official_fibric_target":
        raise ValueError("unexpected or falsely promoted input authority")
    clear_scene()
    warp_material, warp_shader = make_fiber_material("WarmWarpFiber", (0.21, 0.055, 0.018, 1.0), 0.34)
    weft_material, weft_shader = make_fiber_material("DeepWeftFiber", (0.055, 0.017, 0.009, 1.0), 0.39)
    fuzz_material, fuzz_shader = make_fiber_material("FuzzFiber", (0.34, 0.11, 0.035, 1.0), 0.52)
    families, source_curves = create_yarn_splines(payload)
    ply_radius = float(payload["renderRecipe"]["plyRadiusM"])
    make_curve_object("WarpMultifiber", families["warp"], ply_radius, warp_material)
    make_curve_object("WeftMultifiber", families["weft"], ply_radius, weft_material)
    create_fuzz(source_curves, payload, fuzz_material)
    width, height = map(float, payload["tileSizeM"])
    add_ground(width, height)
    target = configure_scene(payload, max(8, args.samples))
    render_views(payload, args.out, target)
    blend = args.out / "multifiber_reference.blend"
    bpy.ops.wm.save_as_mainfile(filepath=str(blend))
    report = {
        "schema": "kaopu/native_yarn_render_receipt@0.1",
        "blenderVersion": bpy.app.version_string,
        "renderEngine": bpy.context.scene.render.engine,
        "inputAuthority": payload["authority"],
        "officialFibricPatternUsed": False,
        "visualAcceptance": False,
        "curveCount": payload["curveCount"],
        "centerlinePoints": payload["pointCount"],
        "plySplineCount": len(families["warp"]) + len(families["weft"]),
        "fuzzSplineCount": int(payload["renderRecipe"]["fuzzCount"]),
        "shaderModes": sorted({warp_shader, weft_shader, fuzz_shader}),
        "outputs": ["macro.png", "grazing.png", "multifiber_reference.blend"],
    }
    (args.out / "render-report.json").write_text(json.dumps(report, indent=2))
    print(json.dumps(report))


if __name__ == "__main__":
    main()
