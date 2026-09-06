
#version 300 es

in vec2 a_position;

uniform vec2 u_resolution;

void main() {
    
  float x = (a_position.x / u_resolution.x) * 2.0 - 1.0;
  float y = 1.0 - (a_position.y / u_resolution.y) * 2.0;

  gl_Position = vec4(x, y, 0.0, 1.0);
}