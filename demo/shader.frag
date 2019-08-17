#version 450
precision mediump float;

uniform float time;
uniform float resolutionWidth;
uniform float resolutionHeight;

uniform sampler2D firstPassTexture;
const float PI = 3.14;
const float fallAt = 0.5;

vec4 _gl_Position;
#define gl_Position _gl_Position

#pragma attributes

vec3 aPosition;
vec2 aUV;

#pragma varyings

vec3 vColor;
vec2 vUV;

#pragma outputs

vec4 color;

#pragma common

// TODO move
const float TAU = 6.28;
float beat = time * 0.78;// BPS

float md(float p, float m) {
	return mod(p - m*0.5, m) - m*0.5;
}

void amod(inout vec2 p, float d) {
	float a = md(atan(p.y, p.x), TAU / d);
	p = vec2(cos(a), sin(a)) * length(p);
}

void amodm(inout vec2 p, float d) {
	float a = abs(md(atan(p.y, p.x), TAU / d));
	p = vec2(cos(a), sin(a)) * length(p);
}

vec3 palette(vec3 a, vec3 b, vec3 c, vec3 d, float t) {
	return a + b * cos(TAU * (c * t + d));
}

vec4 colorize() {
	return vec4(palette(vec3(0.5), vec3(0.5), vec3(1.0), vec3(0.0, 1.0, 2.0) / 3.0, floor(beat) * 0.1), 1.0);
}

mat2 rot(float a) {
	float c = cos(a), s = sin(a);
	return mat2(c, - s, s, c);
}

vec3 curve(float ratio) {
	float tt = smoothstep(0.0, fallAt+.15, fract(beat));
	float ttt = floor(beat) * 10.0;
	ratio *= 1.0 + tt * 9.0;
	ratio += ttt;
	vec3 position = vec3(0.5 + 0.3 * sin(ratio), 0, 0);
	position.yz *= rot(ratio * 1.58);
	position.xz *= rot(ratio * 2.);
	position.yx *= rot(ratio * 1.5);
	position.xz *= rot(tt * 1.5 + ttt);
	position.yz *= rot(-tt * 2.0 + ttt);
	position.x /= resolutionWidth / resolutionHeight;
	return position;
}

float halftone(vec2 st, float dir) {
	vec2 fst = fract(st), ist = floor(st), wp = ist + step(0.5, fst), bp = ist + vec2(0.5);
	float wl = length(st - wp), bl = length(st - bp);
	return step(dir, bl / (bl + wl));
}

float floors(float x) {
	return floor(x) + smoothstep(0.9, 1.0, fract(x));
}

// RIBBONS

#pragma vertex 0

void mainV0() {
	vec3 position = aPosition;
	float ratio = (aUV.x * 0.5 + 0.5) * smoothstep(0.0, 0.1, fract(beat));
	float size = 0.04;
	float fall = smoothstep(fallAt, 1.0, fract(beat));
	size *= smoothstep(0.1, 0.0, fall);
	position = curve(ratio);
	vec3 next = curve(ratio + 0.01);
	vec2 y = normalize(next.xy - position.xy);
	vec2 x = vec2(y.y, - y.x);
	position.xy += size * x * aUV.y * vec2(resolutionHeight / resolutionWidth, 1);
	position.xy /= 1.0 + position.z;
	gl_Position = vec4(position, 1.0);
	vColor = cross(normalize(next-position), vec3(0,1,0));
	// vColor = vec3(aUV*0.5+0.5, 0);
}

#pragma fragment 0

void mainF0() {
	// vec2 uv = gl_FragCoord.xy / vec2(resolutionWidth, resolutionHeight);
	color = colorize();// * ceil((uv.x+uv.y)*4.0)/4.0;
}

// PARTICLES

#pragma vertex 1

void mainV1() {
	vec3 position = curve(aPosition.y);
	vec2 aspectRatio = vec2(resolutionHeight / resolutionWidth, 1);
	float fall = smoothstep(fallAt, 1.0, fract(beat));
	float size = (0.04 + 0.02 * sin(aPosition.y * 8654.567)) * smoothstep(1.0, 0.6, fall) * smoothstep(0.0, 0.2, fall);
	float a = sin(aPosition.y * 135734.2657) * TAU;
	float r = sin(aPosition.y * 687451.5767) * 2.0 + 1.0;
	vec2 offset = vec2(cos(a), sin(a)) * aspectRatio * r;
	offset.y -= sin(fall * PI) * 0.5;
	// offset += vec2(cos(a), sin(a)) * 0.02;
	// position = curve(-fall);
	// position.y -= 7.0 * fall;
	position.xy -= offset * fall;
	position.xy += size * aUV.xy * aspectRatio;
	position.xy /= 1.0 + position.z;
	gl_Position = vec4(position, 1.0);
	vColor = vec3(aUV.xy * 0.5 + 0.5, 0);
	vUV = aUV;
}

#pragma fragment 1

void mainF1() {
	float d = length(vUV);
	if (d > 1.0) discard;
	// vec2 uv = gl_FragCoord.xy / vec2(resolutionWidth, resolutionHeight);
	color = colorize();// * ceil((uv.x+uv.y)*4.0)/4.0;
}

// POST FX

#pragma fragment 2

void mainF2() {
	float aspectRatio = resolutionWidth / resolutionHeight;
	float beat = time * 2.08333;// BPS
	
	vec2 uvc = gl_FragCoord.xy / vec2(resolutionWidth, resolutionHeight) - 0.5;
	uvc.x *= aspectRatio;
	
	float ht = halftone(uvc * 100.0 * rot(PI / 10.0), 0.1);
	
	// A mod kaleidoscope.
	#if 0
	amodm(uvc, floor(fract(sin(floor(beat / 4.0)) * 1e3) * 5.0) + 1.0);
	#endif
	vec2 uv = uvc / vec2(aspectRatio, 1) + 0.5;
	
	// Chromatic aberration.
	#if 0
	for(int i = 0; i < 3; ++ i)
	{
		color[i] = texture(firstPassTexture, (uv - 0.5) * (1.0 + exp(-fract(beat / 4.0)) * (0.01 + float(i) * 0.01)) + 0.5)[i];
	}
	color.a = texture(firstPassTexture, uv).a;
	
	#else
	color = texture(firstPassTexture, uv);
	#endif
	
	float lod = 4.0;
	vec4 bgc = colorize();
	color = mix(1.-bgc, .5*(1.-bgc), halftone(uvc * 40.0 * rot(beat / 20.0), floors((uv.x + uv.y) * lod) / lod / 2.0));
	
	// Halftone.
	#if 0
	// color = mix(color, 1.0 - color, ht);
	color *= ht;
	#endif
	
	// outline
	#if 1
	// color = vec4(0);
	// for (float index = 1.0; index <= 3.0; ++index) {
		// 	float ratio = index/3.0;
		// color = ratio*texture(firstPassTexture, uv+vec2(0.01)*ratio);
		// float a = ratio * TAU;
		// vec2 offset = vec2(cos(a),sin(a)) * 0.1 * (1.-ratio);
		vec4 image = texture(firstPassTexture, uv);
		vec4 frame = texture(firstPassTexture, uv + vec2(0.01));
		float gray = (image.r + image.g + image.b) / 3.0;
		float gray2 = (frame.r + frame.g + frame.b) / 3.0;
		// color = mix(color, mix(0.5 * image, frame, step(0.001, gray2)), step(0.001, gray));
		color = mix(color, 0.5 * image, step(0.001, gray));
		color = mix(color, frame, step(0.001, gray2));
	// }
	#endif
	
	color.a = 1.0;
}
