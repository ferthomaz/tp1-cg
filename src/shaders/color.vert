#version 300 es
layout(location = 0) in vec2 a_position;
layout(location = 1) in vec2 a_uv;

uniform mat4 u_model;
uniform mat4 u_projection;
uniform vec4 u_uvRegion; // offset.xy and scale.zw within the atlas
out vec2 v_uv;
out vec2 v_local;

void main() {
    gl_Position = u_projection * u_model * vec4(a_position, 0.0, 1.0);
    v_local = a_position;
    v_uv = u_uvRegion.xy + a_uv * u_uvRegion.zw;
}
