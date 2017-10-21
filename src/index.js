import { vec3, quat, mat4 } from "gl-matrix";
import FModel from "./FModel";
import * as glUtils from "./glUtils";

function radToDeg(r) {
  return r * 180 / Math.PI;
}

function degToRad(d) {
  return d * Math.PI / 180;
}

function createProgram(
  gl,
  vertexShaderSource,
  fragmentShaderSource,
  attributes,
  uniforms
) {
  var glProgram = glUtils.createProgramFromSources(
    gl,
    vertexShaderSource,
    fragmentShaderSource
  );

  var attribLocations = {};

  Object.entries(attributes).forEach(([key, attrib]) => {
    attribLocations[key] = gl.getAttribLocation(glProgram, attrib);
  });

  var uniformLocations = {};

  Object.entries(uniforms).forEach(([key, uniform]) => {
    uniformLocations[key] = gl.getUniformLocation(glProgram, uniform);
  });

  return {
    glProgram,
    attribLocations,
    uniformLocations
  };
}

function createBuffer(gl, data, target, usage) {
  var buffer = gl.createBuffer();
  gl.bindBuffer(target, buffer);
  gl.bufferData(target, data, usage);
  return buffer;
}

function createVao(gl, program, attributes) {
  // Create a vertex array object (attribute state)
  var vao = gl.createVertexArray();
  // and make it the one we're currently working with
  gl.bindVertexArray(vao);

  var currentBuffer = null;

  Object.entries(attributes).forEach(([key, attribute]) => {
    var attribLocation = program.attribLocations[key];

    // Turn on the attribute
    gl.enableVertexAttribArray(attribLocation);

    if (attribute.buffer !== currentBuffer) {
      // Make the buffer the one we are currently working with.
      gl.bindBuffer(gl.ARRAY_BUFFER, attribute.buffer);
      // Keep track of the buffer so we only bind a new buffer if we need to.
      currentBuffer = attribute.buffer;
    }

    // Tell gl how to get attribute data out of the buffer
    gl.vertexAttribPointer(
      attribLocation, // Where the attribute is to be bound.
      attribute.size, // How many components per iteration.
      attribute.type, // What datatype to use.
      attribute.normalize || false, // Convert from 0-255 to 0.0-1.0?
      attribute.stride || 0, // stride * sizeof(type) each iteration to get the next element
      attribute.offset || 0 // Offset into the buffer.
    );
  });

  return vao;
}

function resizeViewport(gl) {
  glUtils.resizeCanvas(gl.canvas);
  // Tell WebGL how to convert from clip space to pixels
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
}

var canvas = document.getElementById("canvas");
var gl = canvas.getContext("webgl2");

// Clear the canvas
gl.clearColor(0, 0, 0, 0);
// turn on depth testing
gl.enable(gl.DEPTH_TEST);
// tell webgl to cull faces
gl.enable(gl.CULL_FACE);

resizeViewport(gl);
window.addEventListener("resize", _ => resizeViewport(gl));

var vertexShaderSource = `#version 300 es
// an attribute is an input (in) to a vertex shader.
// It will receive data from a buffer
in vec4 a_position;
in vec4 a_color;
// A matrix to transform the positions by
uniform mat4 u_model;
uniform mat4 u_view;
// a varying the color to the fragment shader
out vec4 v_color;
// all shaders have a main function
void main() {
  // Multiply the position by the matrix.
  gl_Position = u_view * u_model * a_position;
  // Pass the color to the fragment shader.
  v_color = a_color;
}
`;
var fragmentShaderSource = `#version 300 es
precision mediump float;
// the varied color passed from the vertex shader
in vec4 v_color;
// we need to declare an output for the fragment shader
out vec4 outColor;
void main() {
  outColor = v_color;
}
`;

var program = createProgram(
  gl,
  vertexShaderSource,
  fragmentShaderSource,
  {
    position: "a_position",
    color: "a_color"
  },
  {
    model: "u_model",
    view: "u_view"
  }
);

// Tell it to use our program (pair of shaders)
gl.useProgram(program.glProgram);

// First let's make some variables
// to hold the translation

var aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
var zNear = 1;
var zFar = 2000;
var fieldOfViewRadians = degToRad(60);
var viewMatrix = mat4.create();
mat4.perspective(viewMatrix, fieldOfViewRadians, aspect, zNear, zFar);
gl.uniformMatrix4fv(program.uniformLocations.view, false, viewMatrix);

var numFs = 1024 * 4;
var modelMatrices = new Array(numFs);
var vaos = new Array(numFs);

for (var i = 0; i < numFs; i++) {
  var translation = vec3.create();
  vec3.set(
    translation,
    Math.random() * -400 + 200,
    Math.random() * 400 - 100,
    Math.random() * -100 - 200
  );

  var rotation = quat.create();
  quat.fromEuler(rotation, 190, 40, 30);

  var scale = vec3.create();
  vec3.set(scale, 1, 1, 1);

  var modelMatrix = mat4.create();
  mat4.fromRotationTranslationScale(modelMatrix, rotation, translation, scale);
  modelMatrices[i] = modelMatrix;

  var buffer = createBuffer(gl, FModel.buffer, gl.ARRAY_BUFFER, gl.STATIC_DRAW);

  vaos[i] = createVao(gl, program, {
    position: {
      buffer,
      size: 3,
      type: gl.FLOAT
    },
    color: {
      buffer,
      size: 3,
      type: gl.UNSIGNED_BYTE,
      normalize: true,
      offset: FModel.colorsBufferView.byteOffset
    }
  });
}

function render() {
  requestAnimationFrame(render);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  for (var i = 0; i < modelMatrices.length; i++) {
    var modelMatrix = modelMatrices[i];
    // Compute the matrix
    mat4.rotateX(modelMatrix, modelMatrix, degToRad(Math.random() * 3));
  }

  for (var i = 0; i < modelMatrices.length; i++) {
    // Bind the attribute/buffer set we want.
    gl.bindVertexArray(vaos[i]);

    var modelMatrix = modelMatrices[i];
    // Set the matrix.
    gl.uniformMatrix4fv(program.uniformLocations.model, false, modelMatrix);

    // Draw the geometry.
    gl.drawArrays(gl.TRIANGLES, 0, FModel.positions.length / 3);
  }
}

render();
