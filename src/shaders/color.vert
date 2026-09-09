
#version 300 es

in vec2 a_position;

uniform mat3 u_matrix;

void main() {
  vec3 position = u_matrix * vec3(a_position, 1.0);
  gl_Position = vec4(position.xy, 0.0, 1.0);
}