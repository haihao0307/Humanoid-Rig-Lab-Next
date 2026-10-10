let shell=null;
self.onmessage=function(e){const {id,op}=e.data,d=e.data;try{
 let result=null;
 if(op==='init')shell=new ProductShell(d.data,d.options);
 else if(!shell)throw Error('Product physics is not initialized');
 else if(op==='active')shell.active=d.value;
 else if(op==='pick')shell.pick(d.ids,d.weights,d.point);
 else if(op==='release')shell.release();
 else if(op==='reset')shell.reset();
 else if(op==='step'){if(d.goal)shell.move(d.goal);shell.step(Math.max(1,Math.min(4,d.count)));}
 else if(op==='test'){
  shell.reset();const q=shell.tri[Math.floor(shell.tri.length*.42)],ids=q.ids,p=[0,0,0];for(const i of ids)for(let j=0;j<3;j++)p[j]+=shell.x[i*3+j]*1000/3;
  const start=shell.x.slice();shell.pick(ids,[1/3,1/3,1/3],p);
  for(let k=0;k<160;k++){shell.move([p[0]+(d.swing?Math.sin(k/20)*55:0),p[1]+Math.min(220,k*2),p[2]+(d.swing?Math.sin(k/29)*30:0)]);shell.step();}
  const held=shell.report();shell.release();for(let k=0;k<48;k++)shell.step();const released=shell.report();shell.active=false;
  result={held,released,positionsChanged:shell.x.some((x,i)=>Math.abs(x-start[i])>.002)};
 }else throw Error('Unknown product physics operation');
 const report=shell.report();const positions=shell.x.slice();self.postMessage({id,result,report,positions},[positions.buffer]);
 }catch(error){self.postMessage({id,error:String(error.stack||error)});}};
