// Original Three r170 cube-UV and DFG equations, recovered from frozen R15.
// See licenses/THREE-MIT.txt. Shared environment cache is lossless Float32.
uniform sampler2D sourceEnvironment;uniform mat3 sourceEnvironmentRotation;uniform float sourceEnvironmentIntensity;uniform vec3 sourceLightDirection[2],sourceLightColour[2];
#define CUBEUV_TEXEL_WIDTH 0.002976190476190476
#define CUBEUV_TEXEL_HEIGHT 0.00390625
#define CUBEUV_MAX_MIP 6.0
uniform float sourceExposure;
vec3 sourceNeutralTone( vec3 color ) {
	const float StartCompression = 0.8 - 0.04;
	const float Desaturation = 0.15;
	color *= sourceExposure;
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
vec3 sourceOriginalOutput(vec3 c){vec2 rg=unpackHalf2x16(packHalf2x16(c.rg)),ba=unpackHalf2x16(packHalf2x16(vec2(c.b,1.)));c=sourceNeutralTone(max(vec3(rg,ba.x),vec3(0.)));return mix(pow(c,vec3(.41666))*1.055-vec3(.055),c*12.92,vec3(lessThanEqual(c,vec3(.0031308))));}
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
		#if 1
			return textureGrad( envMap, uv, vec2( 0.0 ), vec2( 0.0 ) ).rgb;
		#else
			return texture( envMap, uv ).rgb;
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

vec2 sourceDFG(vec3 normal,vec3 viewDir,float roughness){float dotNV=clamp(dot(normal,viewDir),0.,1.);const vec4 c0=vec4(-1.,-.0275,-.572,.022),c1=vec4(1.,.0425,1.04,-.04);vec4 r=roughness*c0+c1;float a004=min(r.x*r.x,exp2(-9.28*dotNV))*r.x+r.y;return vec2(-1.04,1.04)*a004+r.zw;}
vec3 sourceEB1(vec3 normal,vec3 view,float roughness,float oil,vec3 albedo){
 vec3 colour=vec3(0.);for(int i=0;i<2;i++){vec3 l=sourceLightDirection[i];float nl=clamp(dot(normal,l),0.,1.);vec3 spec=mix(sourceGGX(l,view,normal,roughness),sourceGGX(l,view,normal,max(.25,roughness*.62)),.06+oil*.25);colour+=nl*sourceLightColour[i]*(albedo*.3183098861837907+spec);}
 vec3 worldNormal=sourceEnvironmentRotation*normal,reflectVec=reflect(-view,normal);reflectVec=normalize(mix(reflectVec,normal,roughness*roughness));vec3 radiance=textureCubeUV(sourceEnvironment,sourceEnvironmentRotation*reflectVec,roughness).rgb*sourceEnvironmentIntensity;vec3 irradiance=textureCubeUV(sourceEnvironment,worldNormal,1.).rgb*sourceEnvironmentIntensity;
 vec2 fab=sourceDFG(normal,view,roughness);vec3 fss=vec3(.028)*fab.x+sourceSpecularF90*fab.y;float ems=1.-fab.x-fab.y;vec3 favg=vec3(.028)+(1.-vec3(.028))*.047619;vec3 multi=fss*favg/(1.-ems*favg)*ems,total=fss+multi;colour+=radiance*fss+(multi+albedo*(1.-max(max(total.r,total.g),total.b)))*irradiance;return sourceOriginalOutput(colour);
}
