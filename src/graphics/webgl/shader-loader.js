export let shaderSources = null;

export async function loadShaders(read = async url => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Cannot load shader: ${url} (${response.status})`);
    return response.text();
}) {
    if (!shaderSources) {
        const [vertex, fragment] = await Promise.all([
            read(new URL('../../shaders/color.vert', import.meta.url)),
            read(new URL('../../shaders/color.frag', import.meta.url)),
        ]);
        shaderSources = { vertex, fragment };
    }
    return shaderSources;
}
