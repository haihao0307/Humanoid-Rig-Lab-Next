/** Exact arithmetic verifier for stored linear models; not a contact solver. */
const gcd=(a,b)=>{a=a<0n?-a:a;b=b<0n?-b:b;while(b){[a,b]=[b,a%b];}return a||1n;};
const rational=(n,d=1n)=>{if(d===0n)throw Error('ZERO_DENOMINATOR');if(d<0n){n=-n;d=-d;}const g=gcd(n,d);return{n:n/g,d:d/g};};
const add=(a,b)=>rational(a.n*b.d+b.n*a.d,a.d*b.d),mul=(a,b)=>rational(a.n*b.n,a.d*b.d),neg=a=>({n:-a.n,d:a.d}),abs=a=>({n:a.n<0n?-a.n:a.n,d:a.d}),divide=(a,b)=>rational(a.n*b.d,a.d*b.n);
export function exactNumber(value){if(typeof value!=='number'||!Number.isFinite(value))throw Error('FINITE_NUMBER_REQUIRED');if(value===0)return rational(0n);const buffer=new ArrayBuffer(8),d=new DataView(buffer);d.setFloat64(0,value,false);const bits=d.getBigUint64(0,false),exponent=Number((bits>>52n)&2047n),fraction=bits&((1n<<52n)-1n),mantissa=(exponent?(1n<<52n):0n)+fraction,shift=exponent?exponent-1023-52:-1074,sign=bits>>63n?-1n:1n;return shift>=0?rational(sign*mantissa*(1n<<BigInt(shift))):rational(sign*mantissa,1n<<BigInt(-shift));}
function integer(x){if(typeof x!=='string'||x.length>4096||!/^[-]?\d+$/.test(x))throw Error('INVALID_INTEGER');return BigInt(x);}
export function verifyCertificate(c){
 if(!c||!Array.isArray(c.nodes)||c.nodes.length<1||c.nodes.length>24||!Array.isArray(c.rows)||c.rows.length<1||c.rows.length>256||!Number.isFinite(c.boxM)||c.boxM<=0||c.globalNonlinearInfeasibilityProved!==false)throw Error('CERTIFICATE_SCOPE');
 const n=c.nodes.length*3,a=Array.from({length:n},()=>rational(0n));let b=rational(0n),sum=rational(0n);
 for(const row of c.rows){const w=rational(integer(row.weightNumerator),integer(row.weightDenominator));if(w.n<0n||!Array.isArray(row.a)||row.a.length!==n||!['contact','shape'].includes(row.kind))throw Error('INVALID_ROW');if(row.kind==='contact')sum=add(sum,w);b=add(b,mul(w,exactNumber(row.b)));for(let j=0;j<n;j++)a[j]=add(a[j],mul(w,exactNumber(row.a[j])));}
 if(sum.n<=0n)throw Error('NO_CONTACT_WEIGHT');let support=rational(0n);for(const x of a)support=add(support,abs(x));support=mul(support,exactNumber(c.boxM));const gap=divide(add(b,neg(support)),sum),expected=c.verified;
 if(expected&&(String(gap.n)!==expected.numerator||String(gap.d)!==expected.denominator))throw Error('CLAIMED_CERTIFICATE_MISMATCH');
 return{positive:gap.n>0n,numerator:String(gap.n),denominator:String(gap.d),lowerBoundM:Number(gap.n)/Number(gap.d),exactStoredLinearModel:true,nonlinearInfeasibilityProved:false};
}
