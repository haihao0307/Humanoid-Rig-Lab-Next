"""Find small weighted-row contradictions; independently verify using exact rationals.
Only proves an obstruction in the stored initial linear model, NOT nonlinear impossibility.
SciPy is an offline evidence tool, not a browser/production solver dependency.
"""
from pathlib import Path
from fractions import Fraction as F
import json,hashlib,sys,time
import numpy as np
import scipy
from scipy.optimize import linprog
R=Path(__file__).resolve().parent
source=R/'LINEAR_SYSTEMS.json';systems=json.loads(source.read_text())
def number(x):
 if not isinstance(x,(int,float)) or not np.isfinite(x):raise ValueError('NONFINITE_COEFFICIENT')
 return F.from_float(float(x))
def verify(cert):
 n=len(cert['nodes'])*3
 assert 0<n<=72 and cert['boxM']>0
 a=[F(0)]*n;b=F(0);total=F(0)
 for row in cert['rows']:
  w=F(int(row['weightNumerator']),int(row['weightDenominator']));assert w>=0 and len(row['a'])==n
  if row['kind']=='contact':total+=w
  for i,v in enumerate(row['a']):a[i]+=w*number(v)
  b+=w*number(row['b'])
 assert total>0
 support=number(cert['boxM'])*sum(map(abs,a));lower=(b-support)/total
 return {'requiredWeightedM':float(b/total),'maximumWeightedBoxSupportM':float(support/total),'lowerBoundM':float(lower),'numerator':str(lower.numerator),'denominator':str(lower.denominator),'positive':lower>0}
out={'schema':'kaopu/linear-contact-certificates@1','sourceSHA256':hashlib.sha256(source.read_bytes()).hexdigest(),'discoveryTool':{'name':'scipy.optimize.linprog(method=highs)','version':scipy.__version__},'verification':'Python fractions.Fraction exact binary64 coefficients and rational nonnegative weights; independent of LP optimality status','scope':'initial frozen linearization only; not a nonlinear/continuous collision proof','certificates':[]}
for model in systems:
 for include_shape in [False,True]:
  t=time.perf_counter();rows=model['rows']+(model['shape'] if include_shape else []);n=len(model['nodes'])*3
  A=np.array([r['a']+[1 if r['kind']=='contact' else 0] for r in rows]);b=np.array([r['b'] for r in rows]);c=np.zeros(n+1);c[-1]=1
  result=linprog(c,A_ub=-A,b_ub=-b,bounds=[(-model['boxM'],model['boxM'])]*n+[(0,None)],method='highs')
  assert result.success,(model['fixture'],result.message)
  positive=[]
  for weight,row in zip(-result.ineqlin.marginals,rows):
   if weight<=1e-9:continue
   rational=F(format(float(weight),'.12g'))
   positive.append({**row,'weightNumerator':str(rational.numerator),'weightDenominator':str(rational.denominator)})
  cert={'fixture':model['fixture'],'includesLinearizedShape':include_shape,'nodes':model['nodes'],'boxM':model['boxM'],'rows':positive,'LPUniformSlackM':float(result.fun),'originalContactRowCount':len(model['rows']),'originalShapeRowCount':len(model['shape']) if include_shape else 0,'globalNonlinearInfeasibilityProved':False,'sourceWritten':False}
  cert['verified']=verify(cert);assert cert['verified']['positive']
  cert['elapsedMS']=(time.perf_counter()-t)*1000;out['certificates'].append(cert)
  print(model['fixture'],'shape',include_shape,'rows',len(positive),'certified linear gap m',cert['verified']['lowerBoundM'],flush=True)
(R/'CERTIFICATES.json').write_text(json.dumps(out,ensure_ascii=False,indent=2))
# Negative independent tests do not require the LP implementation.
checks=[]
def test(name,condition):
 assert condition,name
 checks.append({'name':name,'passed':True})
test('six exact certificates recompute',len(out['certificates'])==6 and all(verify(c)==c['verified'] for c in out['certificates']))
test('positive weights only',all(int(r['weightNumerator'])>=0 for c in out['certificates'] for r in c['rows']))
test('no nonlinear infeasibility promotion',all(c['globalNonlinearInfeasibilityProved'] is False for c in out['certificates']))
c=out['certificates'][-2];test('step102 contact-only contradiction uses four rows',c['fixture']=='guarded-step102.json' and not c['includesLinearizedShape'] and len(c['rows'])==4)
test('step102 lower bound exceeds2mm',c['verified']['lowerBoundM']>.002)
test('shape-free contradiction is not produced by added deformation restriction',all(c['verified']['positive'] for c in out['certificates'] if not c['includesLinearizedShape']))
q={'nodes':[0],'boxM':.01,'rows':[{'a':[1.,0.,0.],'b':.02,'kind':'contact','weightNumerator':'1','weightDenominator':'1'}]};test('synthetic unreachable bound exactly0.01m',verify(q)['lowerBoundM']==.01)
q['rows'][0]['b']=.005;test('synthetic feasible inequality is not certified impossible',verify(q)['positive'] is False)
q['rows'][0]['weightNumerator']='-1'
try:verify(q);bad=False
except AssertionError:bad=True
test('negative weight rejected',bad)
(R/'qa/CERTIFICATE_TESTS.json').write_text(json.dumps({'passed':True,'checks':checks,'count':len(checks),'realCertificates':6,'syntheticExamplesLabelled':True},indent=2))
