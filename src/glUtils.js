export function resizeCanvas(canvas) {
  var cssToRealPixels = window.devicePixelRatio || 1;

  var displayWidth = Math.floor(canvas.clientWidth * cssToRealPixels);
  var displayHeight = Math.floor(canvas.clientHeight * cssToRealPixels);

  if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
    canvas.width = displayWidth;
    canvas.height = displayHeight;
  }
}

export function createProgramFromSources(gl, vertexSource, fragmentSource) {
  var vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource);
  var fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  return createProgram(gl, vertexShader, fragmentShader);
}

export function createProgram(gl, vertexShader, fragmentShader) {
  var program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    var message = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(message);
  }

  return program;
}

export function createShader(gl, type, source) {
  var shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    var message = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(message);
  }

  return shader;
}

export function createAndUploadBuffer(gl, target, data) {
  var buffer = gl.createBuffer();
  gl.bindBuffer(target, buffer);
  gl.bufferData(target, data, gl.STATIC_DRAW);
  return buffer;
}
