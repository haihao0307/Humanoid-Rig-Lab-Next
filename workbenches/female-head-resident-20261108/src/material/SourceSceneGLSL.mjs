// Three r170 cube-UV, DFG and neutral tone functions retained from frozen source.
export const SOURCE_SCENE_GLSL=`
uniform highp sampler2D u_sceneEnvironment;
uniform mat3 u_sceneWorldFromHead,u_sceneEnvRotation;
uniform vec3 u_sceneLightDirections[2],u_sceneLightRadiance[2],u_sceneBackground;
uniform float u_sceneExposure,u_sceneEnvironmentIntensity;uniform int u_sceneEnvironmentActive;
#define ENVMAP_TYPE_CUBE_UV
#define CUBEUV_TEXEL_WIDTH 0.002976190476190476
#define CUBEUV_TEXEL_HEIGHT 0.00390625
#define CUBEUV_MAX_MIP 6.0
vec4 sceneBilinear(sampler2D source,vec2 uv){vec2 q=uv*vec2(textureSize(source,0))-.5;ivec2 i=ivec2(floor(q)),hi=textureSize(source,0)-1;vec2 f=fract(q);return mix(mix(texelFetch(source,clamp(i,ivec2(0),hi),0),texelFetch(source,clamp(i+ivec2(1,0),ivec2(0),hi),0),f.x),mix(texelFetch(source,clamp(i+ivec2(0,1),ivec2(0),hi),0),texelFetch(source,clamp(i+ivec2(1,1),ivec2(0),hi),0),f.x),f.y);}
#ifdef ENVMAP_TYPE_CUBE_UV
	#define cubeUV_minMipLevel 4.0
	#define cubeUV_minTileSize 16.0
	float getFace( vec3 direction ) {
		vec3 absDirection = abs( direction );
		float face = - 1.0;
		if ( absDirection.x > absDirection.z ) {
			if ( absDirection.x > absDirection.y )
				face = direction.x > 0.0 ? 0.0 : 3.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		} else {
			if ( absDirection.z > absDirection.y )
				face = direction.z > 0.0 ? 2.0 : 5.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		}
		return face;
	}
	vec2 getUV( vec3 direction, float face ) {
		vec2 uv;
		if ( face == 0.0 ) {
			uv = vec2( direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 1.0 ) {
			uv = vec2( - direction.x, - direction.z ) / abs( direction.y );
		} else if ( face == 2.0 ) {
			uv = vec2( - direction.x, direction.y ) / abs( direction.z );
		} else if ( face == 3.0 ) {
			uv = vec2( - direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 4.0 ) {
			uv = vec2( - direction.x, direction.z ) / abs( direction.y );
		} else {
			uv = vec2( direction.x, direction.y ) / abs( direction.z );
		}
		return 0.5 * ( uv + 1.0 );
	}
	vec3 bilinearCubeUV( sampler2D envMap, vec3 direction, float mipInt ) {
		float face = getFace( direction );
		float filterInt = max( cubeUV_minMipLevel - mipInt, 0.0 );
		mipInt = max( mipInt, cubeUV_minMipLevel );
		float faceSize = exp2( mipInt );
		highp vec2 uv = getUV( direction, face ) * ( faceSize - 2.0 ) + 1.0;
		if ( face > 2.0 ) {
			uv.y += faceSize;
			face -= 3.0;
		}
		uv.x += face * faceSize;
		uv.x += filterInt * 3.0 * cubeUV_minTileSize;
		uv.y += 4.0 * ( exp2( CUBEUV_MAX_MIP ) - faceSize );
		uv.x *= CUBEUV_TEXEL_WIDTH;
		uv.y *= CUBEUV_TEXEL_HEIGHT;
		#ifdef texture2DGradEXT
			return texture2DGradEXT( envMap, uv, vec2( 0.0 ), vec2( 0.0 ) ).rgb;
		#else
			return sceneBilinear( envMap, uv ).rgb;
		#endif
	}
	#define cubeUV_r0 1.0
	#define cubeUV_m0 - 2.0
	#define cubeUV_r1 0.8
	#define cubeUV_m1 - 1.0
	#define cubeUV_r4 0.4
	#define cubeUV_m4 2.0
	#define cubeUV_r5 0.305
	#define cubeUV_m5 3.0
	#define cubeUV_r6 0.21
	#define cubeUV_m6 4.0
	float roughnessToMip( float roughness ) {
		float mip = 0.0;
		if ( roughness >= cubeUV_r1 ) {
			mip = ( cubeUV_r0 - roughness ) * ( cubeUV_m1 - cubeUV_m0 ) / ( cubeUV_r0 - cubeUV_r1 ) + cubeUV_m0;
		} else if ( roughness >= cubeUV_r4 ) {
			mip = ( cubeUV_r1 - roughness ) * ( cubeUV_m4 - cubeUV_m1 ) / ( cubeUV_r1 - cubeUV_r4 ) + cubeUV_m1;
		} else if ( roughness >= cubeUV_r5 ) {
			mip = ( cubeUV_r4 - roughness ) * ( cubeUV_m5 - cubeUV_m4 ) / ( cubeUV_r4 - cubeUV_r5 ) + cubeUV_m4;
		} else if ( roughness >= cubeUV_r6 ) {
			mip = ( cubeUV_r5 - roughness ) * ( cubeUV_m6 - cubeUV_m5 ) / ( cubeUV_r5 - cubeUV_r6 ) + cubeUV_m5;
		} else {
			mip = - 2.0 * log2( 1.16 * roughness );		}
		return mip;
	}
	vec4 textureCubeUV( sampler2D envMap, vec3 sampleDir, float roughness ) {
		float mip = clamp( roughnessToMip( roughness ), cubeUV_m0, CUBEUV_MAX_MIP );
		float mipF = fract( mip );
		float mipInt = floor( mip );
		vec3 color0 = bilinearCubeUV( envMap, sampleDir, mipInt );
		if ( mipF == 0.0 ) {
			return vec4( color0, 1.0 );
		} else {
			vec3 color1 = bilinearCubeUV( envMap, sampleDir, mipInt + 1.0 );
			return vec4( mix( color0, color1, mipF ), 1.0 );
		}
	}
#endif
vec3 sceneNeutralToneMapping( vec3 color ) {
	const float StartCompression = 0.8 - 0.04;
	const float Desaturation = 0.15;
	color *= u_sceneExposure;
	float x = min( color.r, min( color.g, color.b ) );
	float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
	color -= offset;
	float peak = max( color.r, max( color.g, color.b ) );
	if ( peak < StartCompression ) return color;
	float d = 1. - StartCompression;
	float newPeak = 1. - d * d / ( peak + d - StartCompression );
	color *= newPeak / peak;
	float g = 1. - 1. / ( Desaturation * ( peak - newPeak ) + 1. );
	return mix( color, vec3( newPeak ), g );
}

vec2 sceneDFGApprox( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = clamp( dot( normal, viewDir ),0.,1. );
	const vec4 c0 = vec4( - 1, - 0.0275, - 0.572, 0.022 );
	const vec4 c1 = vec4( 1, 0.0425, 1.04, - 0.04 );
	vec4 r = roughness * c0 + c1;
	float a004 = min( r.x * r.x, exp2( - 9.28 * dotNV ) ) * r.x + r.y;
	vec2 fab = vec2( - 1.04, 1.04 ) * a004 + r.zw;
	return fab;
}
vec3 sceneEnvironmentBRDF( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness ) {
	vec2 fab = sceneDFGApprox( normal, viewDir, roughness );
	return specularColor * fab.x + specularF90 * fab.y;
}

vec3 sceneEncode(vec3 linear){return mix(pow(max(linear,vec3(0)),vec3(.41666))*1.055-.055,max(linear,vec3(0))*12.92,lessThanEqual(linear,vec3(.0031308)));}
vec3 sceneDisplay(vec3 linear){return sceneEncode(sceneNeutralToneMapping(max(linear,vec3(0))));}
vec3 sceneEnvironment(vec3 direction,float roughness){if(u_sceneEnvironmentActive==0)return vec3(0);return textureCubeUV(u_sceneEnvironment,u_sceneEnvRotation*u_sceneWorldFromHead*normalize(direction),roughness).rgb*u_sceneEnvironmentIntensity;}
vec3 sceneIrradiance(vec3 normal){return 3.141592653589793*sceneEnvironment(normal,1.);}
vec3 sceneRadiance(vec3 normal,vec3 view,float roughness){return sceneEnvironment(normalize(mix(reflect(-view,normal),normal,roughness*roughness)),roughness);}
vec3 sceneIndirect(vec3 normal,vec3 view,vec3 diffuseColor,vec3 specularColor,float roughness,vec3 irradiance){vec2 fab=sceneDFGApprox(normal,view,roughness);vec3 single=specularColor*fab.x+fab.y;float Ems=1.-fab.x-fab.y;vec3 avg=specularColor+(1.-specularColor)*.047619,multi=single*avg/(1.-Ems*avg)*Ems,total=single+multi;return sceneRadiance(normal,view,roughness)*single+(multi+diffuseColor*(1.-max(total.r,max(total.g,total.b))))*irradiance/3.141592653589793;}

uniform sampler2D u_shadowMap0,u_shadowMap1;uniform int u_shadowActive;
uniform vec3 u_shadowEye[2],u_shadowForward[2],u_shadowRight[2],u_shadowUp[2];
float sceneShadowCompare(sampler2D source,vec2 uv,float depth){ivec2 size=textureSize(source,0);return step(depth,texelFetch(source,clamp(ivec2(floor(uv*vec2(size))),ivec2(0),size-1),0).r);}
float scenePCF(sampler2D source,vec3 q){if(any(lessThan(q.xy,vec2(0)))||any(greaterThan(q.xy,vec2(1)))||q.z>1.)return 1.;vec2 t=vec2(2.4/2048.);float sum=0.;for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++)sum+=sceneShadowCompare(source,q.xy+vec2(x,y)*t,q.z);for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){if(x==0&&y==0)continue;sum+=sceneShadowCompare(source,q.xy+vec2(x,y)*t*.5,q.z);}return sum/17.;}
float sceneShadow(vec3 point,vec3 sourceNormal,int light){if(u_shadowActive==0)return 1.;vec3 p=point+sourceNormal*3.-u_shadowEye[light],q=vec3(dot(p,u_shadowRight[light])/2800.+.5,dot(p,u_shadowUp[light])/2800.+.5,(dot(p,u_shadowForward[light])-100.)/7900.-.0002);return light==0?scenePCF(u_shadowMap0,q):scenePCF(u_shadowMap1,q);}
`;
