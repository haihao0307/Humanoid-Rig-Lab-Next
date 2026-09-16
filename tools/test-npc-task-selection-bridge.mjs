import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source=await readFile(new URL('../ui/NPCTaskSelectionBridge.js',import.meta.url),'utf8');
class FakeElement{
 constructor(tag='div'){this.tagName=tag;this.dataset={};this.attributes={};this.children=[];this.listeners={};this.hidden=false;this.value='';this.parentElement=null;this.textContent='';}
 setAttribute(name,value){this.attributes[name]=String(value);if(name==='data-el')this.dataEl=String(value);}
 append(...nodes){for(const node of nodes){node.parentElement=this;this.children.push(node);}}
 insertAdjacentElement(position,node){assert.equal(position,'afterend');this.after=node;node.parentElement=this.parentElement;}
 addEventListener(type,listener){(this.listeners[type]??=[]).push(listener);}
 querySelector(selector){return this.queries?.get(selector)||null;}
}
const context=vm.createContext({console,JSON,Set,Map,Error,Object,String,Array,globalThis:null,document:null,queueMicrotask:fn=>fn(),window:{addEventListener(){}}});
context.globalThis=context;
const api=vm.runInContext(source+'\n({npcTaskSelectedRows,npcTaskRecipientText,installNPCTaskSelectionBridge})',context,{filename:'NPCTaskSelectionBridge.js'});
let rows=[
 {id:'npc-01',label:'林川',selected:true},
 {id:'npc-02',label:'岳石',selected:false},
 {id:'npc-03',label:'禾安',selected:true}
];
const population={activeId:'npc-02',list:()=>rows.map(row=>({...row})),select(ids){const chosen=new Set(ids);rows=rows.map(row=>({...row,selected:chosen.has(row.id)}));return this.list();}};
assert.deepEqual(api.npcTaskSelectedRows(population).map(row=>row.id),['npc-01','npc-03']);
assert.equal(api.npcTaskRecipientText(population),'任务接收者（2）：林川、禾安');

const panel=new FakeElement('section'),target=new FakeElement('select'),selectNone=new FakeElement('button'),toolbar=new FakeElement('div');
selectNone.parentElement=toolbar;panel.ownerDocument={createElement:tag=>new FakeElement(tag)};panel.queries=new Map([['[data-el="target"]',target],['[data-el="selectNone"]',selectNone]]);
const base=()=>({panel,render(){}}),install=api.installNPCTaskSelectionBridge(base),installed=install({},population);
assert.equal(panel.dataset.taskSelectionBridge,'1');
assert.equal(target.hidden,true);assert.equal(target.value,'selected');assert.equal(target.attributes['aria-hidden'],'true');
const current=toolbar.children.find(node=>node.dataEl==='selectCurrent'),invert=toolbar.children.find(node=>node.dataEl==='invertSelection'),recipients=toolbar.after;
assert(current&&invert&&recipients);assert.equal(recipients.textContent,'任务接收者（2）：林川、禾安');
current.onclick();assert.deepEqual(rows.filter(row=>row.selected).map(row=>row.id),['npc-02']);assert.equal(recipients.textContent,'任务接收者（1）：岳石');
invert.onclick();assert.deepEqual(rows.filter(row=>row.selected).map(row=>row.id),['npc-01','npc-03']);
assert.equal(typeof installed.syncTaskRecipients,'function');
console.log(JSON.stringify({passed:true,selected:rows.filter(row=>row.selected).map(row=>row.id),singleAuthority:'population.selected'}));
