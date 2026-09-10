import { ShaderMaterial, DoubleSide, Vector3, Matrix3 } from './vendor/three.module.min.js';

export function softMaterial(map, settings) {
  return new ShaderMaterial({
    side: DoubleSide,
    uniforms: {
      colorMap: { value: map }, patchCenter: { value: new Vector3() },
      upperOffset: { value: new Vector3() }, lowerOffset: { value: new Vector3() },
      radius: { value: .16 }, saturation: { value: settings.saturation },
      restBasis: { value: new Matrix3() },
      cuts: { value: settings.cuts }, steepness: { value: settings.steepness },
      lightDirection: { value: new Vector3(-.469846, .573576, .67101) }
    },
    vertexShader: `
      #include <common>
      #include <skinning_pars_vertex>
      uniform vec3 patchCenter, upperOffset, lowerOffset;
      uniform float radius;
      uniform mat3 restBasis;
      varying vec2 texUV;
      varying vec3 worldNormal;
      void main() {
        vec3 transformed = position;
        vec3 objectNormal = normal;
        vec3 relative = restBasis*(position - patchCenter);
        float q = dot(relative, relative) / (radius * radius);
        if (q < 1.0) {
          float weight = (1.0-q)*(1.0-q);
          vec3 gradient = -4.0*(1.0-q)*relative/(radius*radius);
          float u = clamp(0.5-relative.y/radius, 0.0, 1.0);
          float blend = u*u*(3.0-2.0*u);
          vec3 lowerGradient = gradient*blend + weight*vec3(0.0,-6.0*u*(1.0-u)/radius,0.0);
          gradient = transpose(restBasis)*gradient;
          lowerGradient = transpose(restBasis)*lowerGradient;
          transformed += upperOffset*weight + lowerOffset*weight*blend;
          mat3 jacobian = mat3(vec3(1,0,0)+upperOffset*gradient.x+lowerOffset*lowerGradient.x,
                               vec3(0,1,0)+upperOffset*gradient.y+lowerOffset*lowerGradient.y,
                               vec3(0,0,1)+upperOffset*gradient.z+lowerOffset*lowerGradient.z);
          objectNormal = normalize(transpose(inverse(jacobian))*objectNormal);
        }
        #include <skinbase_vertex>
        #include <skinnormal_vertex>
        #include <skinning_vertex>
        texUV = uv;
        worldNormal = normalize(mat3(modelMatrix)*objectNormal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
      }`,
    fragmentShader: `
      uniform sampler2D colorMap;
      uniform float saturation, cuts, steepness;
      uniform vec3 lightDirection;
      varying vec2 texUV;
      varying vec3 worldNormal;
      void main() {
        vec3 tex = texture2D(colorMap, texUV).rgb;
        vec3 albedo = mix(vec3(dot(tex,vec3(.299,.587,.114))),tex,saturation);
        vec3 n = normalize(worldNormal)*(gl_FrontFacing ? 1.0 : -1.0);
        float amount = dot(n,lightDirection)*steepness;
        float stepped = clamp(amount+mod(1.0-amount,1.0/cuts),0.0,1.0);
        gl_FragColor = vec4(albedo*(.25+1.3817446*stepped),1.0);
      }`
  });
}
