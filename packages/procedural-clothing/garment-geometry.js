import { MeshAccumulator } from './garment-geometry-core.js';
import { buildSeams, generateCollar, generateSleeve, generateTorsoPanel } from './garment-geometry-builders.js';
import { computeInverseMass, computeNormals, extractStructuralEdges } from './garment-geometry-analysis.js';

export function generateCrewShirtGeometry(garmentDNA, fitContract, jointTable) {
  const jointIndexByName = new Map(jointTable.map((name, index) => [name, index]));
  const accumulator = new MeshAccumulator(jointIndexByName);
  generateTorsoPanel(accumulator, garmentDNA, fitContract, true);
  generateTorsoPanel(accumulator, garmentDNA, fitContract, false);
  generateSleeve(accumulator, garmentDNA, fitContract, -1);
  generateSleeve(accumulator, garmentDNA, fitContract, 1);
  generateCollar(accumulator, garmentDNA, fitContract);
  buildSeams(accumulator);
  const positions = new Float32Array(accumulator.positions);
  const indices = new Uint32Array(accumulator.indices);
  const normals = computeNormals(positions, indices);
  const { stretchEdges, restLengths } = extractStructuralEdges(positions, indices);
  const inverseMass = computeInverseMass(positions, indices, garmentDNA.materialDNA.mechanics.arealDensity);
  return {
    positions,
    normals,
    indices,
    skinJoints: new Uint16Array(accumulator.skinJoints),
    skinWeights: new Float32Array(accumulator.skinWeights),
    materialCoords: new Float32Array(accumulator.materialCoords),
    regionIds: new Uint16Array(accumulator.regionIds),
    seamPairs: new Uint32Array(accumulator.seamPairs),
    stretchEdges,
    restLengths,
    inverseMass,
    followWeights: new Float32Array(accumulator.followWeights),
  };
}
