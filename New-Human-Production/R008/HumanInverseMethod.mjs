// One project-owned method for supported adult-human identities.
// These are numerical/graphics priors, not measured internal anatomy.
const freeze=value=>{if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;};
export const HUMAN_INVERSE_METHOD=freeze({
 id:'human/surface-musculoskeletal-inverse@2',species:'homo-sapiens/adult@1',
 stages:['semantic-axes','reference-surface-sections','coupled-joint-candidates','licensed-anatomical-shape-registration','independent-soft-tissue-budgets','surface-constrained-motor-paths','evidence-and-residual-validation'],
 surface:{maxSamples:180000,sections:12,angularBins:24,minSamples:24,minAngularCoverage:.625,iterations:4,maxAspectRatio:5,maxExtentRatio:1.35,maxNormalizedRms:.15,maxNormalizedP95:.40},
 anatomicalShape:{source:'BodyParts3D 4.0',schema:'bp3d-cosine-sdf-r27-1',registration:'atlas-landmarks-to-frozen-surface-candidates',individualGeometry:'NotObserved',preserveAnimationControls:true},
 skeleton:{endpointRange:.30,minSections:4,minSpan:.25,maxEndpointGap:.22,maxHeightShift:.04,maxLengthShift:.20,maxJointDisagreement:.006},
 muscle:{representedVolumeFraction:.55,envelopeInteriorFraction:.86,maximumRadiusFraction:.70,localSectionDistance:.20},
 composition:{referenceAge:32,minimumAge:18,maximumAge:75,minimumRelativeAmount:-1,maximumRelativeAmount:1},
 ownership:{method:'species-shared-and-versioned',adapter:'input-semantic-labels-only',identity:'reference-bones-frozen-once',composition:'muscle-and-fat-budgets-independent'},
 evidence:'authored-surface-fit-and-tissue-priors-not-internal-measurement'
});
export function inverseMethodDescriptor(){return JSON.parse(JSON.stringify(HUMAN_INVERSE_METHOD));}
