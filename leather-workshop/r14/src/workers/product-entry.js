let shell=null,timer=null,nextAt=0,inputSequence=0,epoch=0,speed=0,solveMS=0,sampleWall=0,sampleTime=0;
function stopPump(){if(timer!==null){clearTimeout(timer);timer=null;}}
function emit(id=0,result=null,positions=false,solved=null){const report=solved||shell.report();report.workerSolveMS=solveMS;const out={id,result,report,speed,inputSequence};if(positions){out.positions=shell.x.slice();self.postMessage(out,[out.positions.buffer]);}else self.postMessage(out);}
function schedule(){if(timer!==null||!shell?.active||shell.failed)return;timer=setTimeout(pump,Math.max(0,nextAt-performance.now()));}
function pump(){timer=null;if(!shell?.active||shell.failed)return;const begin=performance.now(),t=shell.time;try{const solved=shell.step(1);const end=performance.now();solveMS=end-begin;if(end-sampleWall>=200){speed=(shell.time-sampleTime)/Math.max(.001,(end-sampleWall)/1000);sampleWall=end;sampleTime=shell.time;}emit(0,null,true,solved);nextAt=begin+1000*shell.cfg.dt/shell.cfg.substeps;schedule();}catch(error){shell.active=false;self.postMessage({error:String(error.stack||error)});}}
self.onmessage=function(e){const d=e.data,{id,op}=d;try{
 if(op==='init'){stopPump();shell=new ImplicitLeatherShell(d.data,d.options);emit(id,null,true);return;}
 if(!shell)throw Error('Product physics is not initialized');
 if(op==='move'){if(d.epoch===epoch&&shell.grab){inputSequence=d.inputSequence;shell.move(d.point);}return;}
 if(op==='pick'){epoch=d.epoch;inputSequence=d.inputSequence;shell.pick(d.ids,d.weights,d.point);nextAt=sampleWall=performance.now();sampleTime=shell.time;emit(id);schedule();return;}
 if(op==='active'){shell.active=d.value;if(!d.value)stopPump();else{nextAt=sampleWall=performance.now();sampleTime=shell.time;schedule();}emit(id);return;}
 if(op==='release'){epoch=d.epoch??epoch;shell.release();emit(id);schedule();return;}
 if(op==='reset'){stopPump();epoch=d.epoch??epoch;shell.reset();speed=0;emit(id,null,true);return;}
 if(op==='audit'){emit(id,shell.contact?.audit(shell.x));return;}
 if(op==='step'||op==='manualStep'){stopPump();shell.active=true;if(d.goal)shell.move(d.goal);shell.step(Math.max(1,Math.min(240,d.count||1)));shell.active=false;emit(id,null,true);return;}
 if(op==='test'){stopPump();shell.reset();const q=shell.tri[Math.floor(shell.tri.length*.42)],ids=q.ids,p=[0,0,0];for(const i of ids)for(let j=0;j<3;j++)p[j]+=shell.x[3*i+j]*1000/3;const start=shell.x.slice();shell.pick(ids,[1/3,1/3,1/3],p);for(let k=0;k<100;k++){shell.move([p[0]+(d.swing?Math.sin(k/13)*45:0),p[1]+Math.min(160,k*2),p[2]+(d.swing?Math.sin(k/18)*30:0)]);shell.step();}const held=shell.report(),heldContact=shell.contact.audit(shell.x);shell.release();for(let k=0;k<36;k++)shell.step();const released=shell.report();shell.active=false;emit(id,{held,released,heldContact,releasedContact:shell.contact.audit(shell.x),positionsChanged:shell.x.some((x,i)=>Math.abs(x-start[i])>.002)},true);return;}
 throw Error('Unknown product physics operation '+op);
 }catch(error){stopPump();self.postMessage({id,error:String(error.stack||error)});}};