// Gray-only research gate. The original eyelid operator needs its native skin
// and eyeball charts but not the separate hair/eyelash display chart. Retain
// the original chart constructors and eyelid math; suppress only that unused
// chart while rebuilding the gray surface. Other person/material modes must
// restore and rebuild all charts before use.
export function installGrayOnlyLidChartGate(viewer,groom,section){
 if(!viewer?.mesh?.geometry||!groom?.charts||!section?.rebuild)throw Error('眼睑来源未准备');
 const rebuild=section.rebuild,empty={attributes:{position:{array:new Float32Array(0)},normal:{array:new Float32Array(0)}},index:{array:new Uint32Array(0)}};let enabled=true,disposed=false,calls=0,elapsedMS=0;
 const replacement=function(){if(!enabled)return rebuild.apply(this,arguments);const oldCharts=groom.charts,oldDisplay=groom.display,oldChartGeometry=groom.chartGeometry;
  groom.charts=function(){const mesh=viewer.mesh,actual=mesh.geometry;mesh.geometry=empty;try{const result=oldCharts.apply(this,arguments),f=this.frame;if(f?.project?.toString()==='c=>{let h=Se(c,i);return[Ae(h,r),Ae(h,o),Ae(h,l)]}'){const origin=f.origin,right=f.x,up=f.up,front=f.front;f.project=p=>{const x=p[0]-origin[0],y=p[1]-origin[1],z=p[2]-origin[2];return[x*right[0]+y*right[1]+z*right[2],x*up[0]+y*up[1]+z*up[2],x*front[0]+y*front[1]+z*front[2]];};}return result;}finally{mesh.geometry=actual;}};
  const start=performance.now();try{return rebuild.apply(this,arguments);}finally{calls++;elapsedMS+=performance.now()-start;groom.charts=oldCharts;groom.display=oldDisplay;groom.chartGeometry=oldChartGeometry;}
 };
 section.rebuild=replacement;
 return Object.freeze({setEnabled(x){enabled=!!x;},report:()=>({grayOnly:true,calls,elapsedMS,displayChartCurrent:false,skinAndLashRestoreSupported:false}),dispose(){if(disposed)return;disposed=true;if(section.rebuild===replacement)section.rebuild=rebuild;}});
}
