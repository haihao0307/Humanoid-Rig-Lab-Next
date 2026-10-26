'use strict';
const fs=require('fs');
module.exports=function read(d){const read28=require('../r28/read-functions.cjs'),p=read28(d);p.displayNormals=read28(d.displayNormals);if(d.headBoundaryFunctions){p.headBoundaryFunctions=read28(d.headBoundaryFunctions);p.allowedJoints=p.headBoundaryFunctions.poseProgram.allowedJoints;p.rig=p.headBoundaryFunctions.poseProgram.rig;if(p.headBoundaryFunctions.poseProgram.allowedPoseIndices)p.allowedPoseIndices=p.headBoundaryFunctions.poseProgram.allowedPoseIndices;}return p;};
