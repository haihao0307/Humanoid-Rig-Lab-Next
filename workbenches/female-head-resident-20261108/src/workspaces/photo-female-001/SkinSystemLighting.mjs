// A lighting reference changes only the light basis, never view rays or geometry.
// Keep this one policy shared by skin, eyes, oral tissues and visibility rays.
export function lightingCamera(camera, settings, reference) {
  if (settings?.lighting !== 'inspection' || !reference) return camera;
  return {...camera, forward: reference.forward, right: reference.right, up: reference.up};
}

export function sameLightingBasis(a,b) {
  return ['forward','right','up'].every(key => a[key].every((v,i)=>Object.is(v,b[key][i]) || Math.abs(v-b[key][i])<1e-14));
}
