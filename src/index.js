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
  uniforms,
  uniformBlocks
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

  var _uniformBlocks = {};

  Object.entries(uniformBlocks).forEach(([key, uniformBlock], i) => {
    var index = gl.getUniformBlockIndex(glProgram, uniformBlock);
    gl.uniformBlockBinding(glProgram, location, i);
    var size = gl.getActiveUniformBlockParameter(
      glProgram,
      index,
      gl.UNIFORM_BLOCK_DATA_SIZE
    );
    _uniformBlocks[key] = {
      index,
      bindingPoint: i,
      size //: gl.getParameter(gl.UNIFORM_BUFFER_OFFSET_ALIGNMENT)
    };
  });

  return {
    glProgram,
    attribLocations,
    uniformLocations,
    uniformBlocks: _uniformBlocks
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
    if (attribute.forceInt) {
      gl.vertexAttribIPointer(
        attribLocation, // Where the attribute is to be bound.
        attribute.size, // How many components per iteration.
        attribute.type, // What datatype to use.
        attribute.stride || 0, // stride * sizeof(type) each iteration to get the next element
        attribute.offset || 0 // Offset into the buffer.
      );
    } else {
      gl.vertexAttribPointer(
        attribLocation, // Where the attribute is to be bound.
        attribute.size, // How many components per iteration.
        attribute.type, // What datatype to use.
        attribute.normalize || false, // Convert from 0-255 to 0.0-1.0?
        attribute.stride || 0, // stride * sizeof(type) each iteration to get the next element
        attribute.offset || 0 // Offset into the buffer.
      );
    }
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

var BATCH_SIZE = 1024;
var numFs = BATCH_SIZE * 4;

var vertexShaderSource = `#version 300 es
// an attribute is an input (in) to a vertex shader.
// It will receive data from a buffer
in vec4 a_position;
in vec4 a_color;
in uint a_instance;

// A matrix to transform the positions by
uniform Model {
  mat4 matrix[${BATCH_SIZE}];
} u_model;

uniform mat4 u_view;
// a varying the color to the fragment shader
out vec4 v_color;
// all shaders have a main function
void main() {
  // Multiply the position by the matrix.
  gl_Position = u_view * u_model.matrix[a_instance] * a_position;
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
    instance: "a_instance",
    position: "a_position",
    color: "a_color"
  },
  {
    view: "u_view"
  },
  {
    model: "Model"
  }
);

// First let's make some variables
// to hold the translation

var aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
var zNear = 1;
var zFar = 2000;
var fieldOfViewRadians = degToRad(60);
var viewMatrix = mat4.create();
mat4.perspective(viewMatrix, fieldOfViewRadians, aspect, zNear, zFar);

var uniformBlockSize = program.uniformBlocks.model.size;
var uniformPerSceneBuffer = gl.createBuffer();
gl.bindBuffer(gl.UNIFORM_BUFFER, uniformPerSceneBuffer);
gl.bufferData(gl.UNIFORM_BUFFER, uniformBlockSize, gl.DYNAMIC_DRAW);

var typedArray = new Float32Array(numFs * 16);
var modelMatrices = [];
var vaos = [];

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
  typedArray.set(modelMatrix, i * 16);

  modelMatrices.push(typedArray.subarray(i * 16, i * 16 + 16));

  var instanceId = i % BATCH_SIZE;
  var buffer = createBuffer(gl, FModel.buffer, gl.ARRAY_BUFFER, gl.STATIC_DRAW);
  var instanceIds = new Uint16Array(
    new Array(FModel.positions.length).fill(instanceId)
  );
  var instanceBuffer = createBuffer(
    gl,
    instanceIds,
    gl.ARRAY_BUFFER,
    gl.STATIC_DRAW
  );

  vaos.push(
    createVao(gl, program, {
      instance: {
        buffer: instanceBuffer,
        size: 1,
        type: gl.UNSIGNED_SHORT,
        forceInt: true
      },
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
    })
  );
}

var mvpMatrix = mat4.create();

// Tell it to use our program (pair of shaders)
gl.useProgram(program.glProgram);
gl.uniformMatrix4fv(program.uniformLocations.view, false, viewMatrix);

function render() {
  requestAnimationFrame(render);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  for (var i = 0; i < numFs; i++) {
    var matrix = modelMatrices[i];
    mat4.rotateX(matrix, matrix, degToRad(Math.random() * 3));
  }

  var numBatches = numFs / BATCH_SIZE;

  for (var batch = 0; batch < numBatches; batch++) {
    gl.bufferSubData(
      gl.UNIFORM_BUFFER,
      0,
      typedArray.subarray(
        batch * BATCH_SIZE * 16,
        (batch + 1) * BATCH_SIZE * 16
      )
    );
    gl.bindBufferBase(
      gl.UNIFORM_BUFFER,
      program.uniformBlocks.model.index,
      uniformPerSceneBuffer
    );

    for (var j = 0; j < BATCH_SIZE; j++) {
      var fIndex = batch * BATCH_SIZE + j;
      gl.bindVertexArray(vaos[fIndex]);
      gl.drawArrays(gl.TRIANGLES, 0, 16 * 6);
    }
  }
}

render();
