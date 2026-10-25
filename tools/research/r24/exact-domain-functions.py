"""Exact projective integer predicates for offline analytic domain compilation.

Source Float32 samples are dyadic rationals. Intersections stay homogeneous;
no expansion epsilon fills microscopic gaps or changes an original domain.
Only final analytic decision coefficients are converted to Float64.
"""
from math import gcd
def canonical_point(p):
 x,y,w=map(int,p)
 if not w: raise RuntimeError('Parallel projective intersection')
 g=gcd(gcd(abs(x),abs(y)),abs(w));x//=g;y//=g;w//=g
 if w<0:x=-x;y=-y;w=-w
 return (x,y,w)
def point_from_real(p):
 x,dx=float(p[0]).as_integer_ratio();y,dy=float(p[1]).as_integer_ratio()
 return canonical_point((x*dy,y*dx,dx*dy))
def cross(a,b):return(a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])
def line(a,b):
 l=cross(a,b);g=gcd(gcd(abs(l[0]),abs(l[1])),abs(l[2]))
 if not g:raise RuntimeError('Duplicate exact edge')
 return tuple(v//g for v in l)
def line_float(l):
 s=max(abs(l[0]),abs(l[1]));a=l[0]/s;b=l[1]/s;c=l[2]/s;n=math.hypot(a,b)
 return(a/n,b/n,c/n)
def dot(l,p):return l[0]*p[0]+l[1]*p[1]+l[2]*p[2]
def signed_area(poly):return dot(cross(poly[0],poly[1]),poly[2])
def nonzero_area(poly):return len(poly)>=3 and any(dot(cross(poly[0],poly[1]),p) for p in poly[2:])
def distances(poly,l):return[dot(l,p) for p in poly]
def split(poly,l):
 ds=distances(poly,l);positive=[];negative=[]
 for i,a in enumerate(poly):
  b=poly[(i+1)%len(poly)];da=ds[i];db=ds[(i+1)%len(poly)]
  if da>=0:positive.append(a)
  if da<=0:negative.append(a)
  if da>0 and db<0 or da<0 and db>0:
   p=canonical_point(cross(line(a,b),l));positive.append(p);negative.append(p)
 def clean(points):
  result=[]
  for p in points:
   if not result or p!=result[-1]:result.append(p)
  if len(result)>1 and result[0]==result[-1]:result.pop()
  return result if nonzero_area(result) else []
 return clean(positive),clean(negative)
def contains(cell,poly):return all(min(distances(cell,line(poly[i],poly[(i+1)%len(poly)])))>=0 for i in range(len(poly)) if poly[i]!=poly[(i+1)%len(poly)])
