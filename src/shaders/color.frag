#version 300 es
precision mediump float;
in vec2 v_uv;
in vec2 v_local;
// x: 0 = square, 1 = circle/ring, 2 = triangle. y: normalized inner radius.
uniform vec2 u_shape;
uniform sampler2D u_texture;
uniform bool u_useTexture;
uniform vec4 u_color;
out vec4 outColor;

void main() {
    if (u_shape.x == 1.0) {
        float radius = length(v_local * 2.0 - 1.0);
        if (radius > 1.0 || radius < u_shape.y) discard;
    } else if (u_shape.x == 2.0 && v_local.x + v_local.y > 1.0) {
        discard;
    }
    outColor = u_color;
    if (u_useTexture) outColor *= texture(u_texture, v_uv);
}
