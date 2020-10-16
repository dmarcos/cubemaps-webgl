// WebGL - Textures - Cubemap
// from https://webglfundamentals.org/webgl/webgl-cubemap.html


"use strict";

function main() {
  // Get A WebGL context
  /** @type {HTMLCanvasElement} */
  var canvas = document.querySelector("#canvas");
  var gl = canvas.getContext("webgl");
  if (!gl) {
    return;
  }

  // setup GLSL program
  var program = webglUtils.createProgramFromScripts(gl, ["vertex-shader-3d", "fragment-shader-3d"]);

  // look up where the vertex data needs to go.
  var positionLocation = gl.getAttribLocation(program, "a_position");

  // lookup uniforms
  var matrixLocation = gl.getUniformLocation(program, "u_matrix");
  var textureLocation = gl.getUniformLocation(program, "u_texture");

  // Create a buffer for positions
  var positionBuffer = gl.createBuffer();
  // Bind it to ARRAY_BUFFER (think of it as ARRAY_BUFFER = positionBuffer)
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  // Put the positions in the buffer
  setGeometry(gl);

  function radToDeg(r) {
    return r * 180 / Math.PI;
  }

  function degToRad(d) {
    return d * Math.PI / 180;
  }

  var fieldOfViewRadians = degToRad(60);
  var modelXRotationRadians = degToRad(0);
  var modelYRotationRadians = degToRad(0);

  // Get the starting time.
  var then = 0;

  // Create a texture.
  var texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);

  loadDDS(texture, function () {
    requestAnimationFrame(drawScene);
  });

  // Get A 2D context
  /** @type {Canvas2DRenderingContext} */
  const ctx = document.createElement("canvas").getContext("2d");

  ctx.canvas.width = 128;
  ctx.canvas.height = 128;

  /*const faceInfos = [
    { target: gl.TEXTURE_CUBE_MAP_POSITIVE_X, faceColor: '#F00', textColor: '#0FF', text: '+X' },
    { target: gl.TEXTURE_CUBE_MAP_NEGATIVE_X, faceColor: '#FF0', textColor: '#00F', text: '-X' },
    { target: gl.TEXTURE_CUBE_MAP_POSITIVE_Y, faceColor: '#0F0', textColor: '#F0F', text: '+Y' },
    { target: gl.TEXTURE_CUBE_MAP_NEGATIVE_Y, faceColor: '#0FF', textColor: '#F00', text: '-Y' },
    { target: gl.TEXTURE_CUBE_MAP_POSITIVE_Z, faceColor: '#00F', textColor: '#FF0', text: '+Z' },
    { target: gl.TEXTURE_CUBE_MAP_NEGATIVE_Z, faceColor: '#F0F', textColor: '#0F0', text: '-Z' },
  ];
  faceInfos.forEach((faceInfo) => {
    const {target, faceColor, textColor, text} = faceInfo;
    generateFace(ctx, faceColor, textColor, text);

    // Upload the canvas to the cubemap face.
    const level = 0;
    const internalFormat = gl.RGBA;
    const format = gl.RGBA;
    const type = gl.UNSIGNED_BYTE;
    gl.texImage2D(target, level, internalFormat, format, type, ctx.canvas);
  });

  gl.generateMipmap(gl.TEXTURE_CUBE_MAP);*/

  gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

  // Draw the scene.
  function drawScene(time) {
    // convert to seconds
    time *= 0.001;
    // Subtract the previous time from the current time
    var deltaTime = time - then;
    // Remember the current time for the next frame.
    then = time;

    webglUtils.resizeCanvasToDisplaySize(gl.canvas);

    // Tell WebGL how to convert from clip space to pixels
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);

    // Animate the rotation
    modelYRotationRadians += -0.7 * deltaTime;
    modelXRotationRadians += -0.4 * deltaTime;

    // Clear the canvas AND the depth buffer.
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Tell it to use our program (pair of shaders)
    gl.useProgram(program);

    // Turn on the position attribute
    gl.enableVertexAttribArray(positionLocation);

    // Bind the position buffer.
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

    // Tell the position attribute how to get data out of positionBuffer (ARRAY_BUFFER)
    var size = 3;          // 3 components per iteration
    var type = gl.FLOAT;   // the data is 32bit floats
    var normalize = false; // don't normalize the data
    var stride = 0;        // 0 = move forward size * sizeof(type) each iteration to get the next position
    var offset = 0;        // start at the beginning of the buffer
    gl.vertexAttribPointer(
        positionLocation, size, type, normalize, stride, offset);

    // Compute the projection matrix
    var aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
    var projectionMatrix =
        m4.perspective(fieldOfViewRadians, aspect, 1, 2000);

    var cameraPosition = [0, 0, 2];
    var up = [0, 1, 0];
    var target = [0, 0, 0];

    // Compute the camera's matrix using look at.
    var cameraMatrix = m4.lookAt(cameraPosition, target, up);

    // Make a view matrix from the camera matrix.
    var viewMatrix = m4.inverse(cameraMatrix);

    var viewProjectionMatrix = m4.multiply(projectionMatrix, viewMatrix);

    var matrix = m4.xRotate(viewProjectionMatrix, modelXRotationRadians);
    matrix = m4.yRotate(matrix, modelYRotationRadians);

    // Set the matrix.
    gl.uniformMatrix4fv(matrixLocation, false, matrix);

    // Tell the shader to use texture unit 0 for u_texture
    gl.uniform1i(textureLocation, 0);

    // Draw the geometry.
    gl.drawArrays(gl.TRIANGLES, 0, 6 * 6);

    requestAnimationFrame(drawScene);
  }

  function loadDDS(texture, callback) {
    var texture = gl.createTexture();
    var ddsXhr = new XMLHttpRequest();

    ddsXhr.open('GET', 'lena_dxt5.dds', true);
    ddsXhr.responseType = 'arraybuffer';
    ddsXhr.onload = function() {

      // gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);
     var mipmaps = uploadDDSLevels(gl, this.response);

      if(callback) { callback(texture); }
    };
    ddsXhr.send(null);

    return texture;
  }

  function uploadDDSLevels(gl, arrayBuffer, loadMipmaps) {
    var headerLengthInt = 31; // The header length in 32 bit ints

    // Offsets into the header array
    var off_magic = 0;

    var off_size = 1;
    var off_flags = 2;
    var off_height = 3;
    var off_width = 4;

    var off_mipmapCount = 7;

    var off_pfFlags = 20;
    var off_pfFourCC = 21;

    var DDS_MAGIC = 0x20534444;
    var DDSD_CAPS = 0x1,
        DDSD_HEIGHT = 0x2,
        DDSD_WIDTH = 0x4,
        DDSD_PITCH = 0x8,
        DDSD_PIXELFORMAT = 0x1000,
        DDSD_MIPMAPCOUNT = 0x20000,
        DDSD_LINEARSIZE = 0x80000,
        DDSD_DEPTH = 0x800000;

    var DDSCAPS_COMPLEX = 0x8,
        DDSCAPS_MIPMAP = 0x400000,
        DDSCAPS_TEXTURE = 0x1000;

    var DDSCAPS2_CUBEMAP = 0x200,
        DDSCAPS2_CUBEMAP_POSITIVEX = 0x400,
        DDSCAPS2_CUBEMAP_NEGATIVEX = 0x800,
        DDSCAPS2_CUBEMAP_POSITIVEY = 0x1000,
        DDSCAPS2_CUBEMAP_NEGATIVEY = 0x2000,
        DDSCAPS2_CUBEMAP_POSITIVEZ = 0x4000,
        DDSCAPS2_CUBEMAP_NEGATIVEZ = 0x8000,
        DDSCAPS2_VOLUME = 0x200000;

    var DDPF_ALPHAPIXELS = 0x1,
        DDPF_ALPHA = 0x2,
        DDPF_FOURCC = 0x4,
        DDPF_RGB = 0x40,
        DDPF_YUV = 0x200,
        DDPF_LUMINANCE = 0x20000;

    function FourCCToInt32(value) {
        return value.charCodeAt(0) +
            (value.charCodeAt(1) << 8) +
            (value.charCodeAt(2) << 16) +
            (value.charCodeAt(3) << 24);
    }

    var FOURCC_DXT1 = FourCCToInt32("DXT1");
    var FOURCC_DXT5 = FourCCToInt32("DXT5");

    var ext = gl.getExtension('WEBGL_compressed_texture_s3tc');
    var header = new Int32Array(arrayBuffer, 0, headerLengthInt),
        fourCC, blockBytes, internalFormat,
        width, height, dataLength, dataOffset,
        byteArray, mipmapCount, i;

    if(header[off_magic] != DDS_MAGIC) {
        console.error("Invalid magic number in DDS header");
        return 0;
    }

    if(!header[off_pfFlags] & DDPF_FOURCC) {
        console.error("Unsupported format, must contain a FourCC code");
        return 0;
    }

    fourCC = header[off_pfFourCC];
    switch(fourCC) {
        case FOURCC_DXT1:
            blockBytes = 8;
            internalFormat = ext.COMPRESSED_RGBA_S3TC_DXT1_EXT;
            break;

        case FOURCC_DXT5:
            blockBytes = 16;
            internalFormat = ext.COMPRESSED_RGBA_S3TC_DXT5_EXT;
            break;

        default:
            console.error("Unsupported FourCC code:", Int32ToFourCC(fourCC));
            return null;
    }

    mipmapCount = 1;
    if(header[off_flags] & DDSD_MIPMAPCOUNT && loadMipmaps !== false) {
        mipmapCount = Math.max(1, header[off_mipmapCount]);
    }

    width = header[off_width];
    height = header[off_height];
    dataOffset = header[off_size] + 4;

   /* for(i = 0; i < mipmapCount; ++i) {
        dataLength = Math.max( 4, width )/4 * Math.max( 4, height )/4 * blockBytes;
        byteArray = new Uint8Array(arrayBuffer, dataOffset, dataLength);
        gl.compressedTexImage2D(gl.TEXTURE_2D, i, internalFormat, width, height, 0, byteArray);
        dataOffset += dataLength;
        width *= 0.5;
        height *= 0.5;
    }*/

    debugger;
    dataLength = Math.max( 4, width )/4 * Math.max( 4, height )/4 * blockBytes;
    byteArray = new Uint8Array(arrayBuffer, dataOffset, dataLength);

    var faceColor = '#F00';
    var textColor = '#0FF';
    var text = '+X';
    generateFace(ctx, faceColor, textColor, text);

    // Upload the canvas to the cubemap face.
    const level = 0;

    /*const format = gl.RGBA;
    const type = gl.UNSIGNED_BYTE;
    internalFormat = gl.RGBA;

    gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X, level, internalFormat, format, type, ctx.canvas);
    gl.texImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_X, level, internalFormat, format, type, ctx.canvas);
    gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_Y, level, internalFormat, format, type, ctx.canvas);
    gl.texImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_Y, level, internalFormat, format, type, ctx.canvas);
    gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_Z, level, internalFormat, format, type, ctx.canvas);
    gl.texImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_Z, level, internalFormat, format, type, ctx.canvas);*/

    gl.compressedTexImage2D(
      gl.TEXTURE_CUBE_MAP_POSITIVE_X, level,
      internalFormat,
      width, height, // width, height of the image
      0, // border, always 0
      byteArray);

    gl.compressedTexImage2D(
      gl.TEXTURE_CUBE_MAP_NEGATIVE_X, level,
      internalFormat,
      width, height, // width, height of the image
      0, // border, always 0
      byteArray);

    gl.compressedTexImage2D(
      gl.TEXTURE_CUBE_MAP_POSITIVE_Y, level,
      internalFormat,
      width, height, // width, height of the image
      0, // border, always 0
      byteArray);

    gl.compressedTexImage2D(
      gl.TEXTURE_CUBE_MAP_NEGATIVE_Y, level,
      internalFormat,
      width, height, // width, height of the image
      0, // border, always 0
      byteArray);

    gl.compressedTexImage2D(
      gl.TEXTURE_CUBE_MAP_POSITIVE_Z, level,
      internalFormat,
      width, height, // width, height of the image
      0, // border, always 0
      byteArray);

    gl.compressedTexImage2D(
      gl.TEXTURE_CUBE_MAP_NEGATIVE_Z, i,
      internalFormat,
      width, height, // width, height of the image
      0, // border, always 0
      byteArray);

    let errorCode = gl.getError();
    if (errorCode !== 0) {
      console.log('renderingError, WebGL Error Code: ' + errorCode);
    }

    return mipmapCount;
  }
}

function generateFace(ctx, faceColor, textColor, text) {
  const {width, height} = ctx.canvas;
  ctx.fillStyle = faceColor;
  ctx.fillRect(0, 0, width, height);
  ctx.font = `${width * 0.7}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = textColor;
  ctx.fillText(text, width / 2, height / 2);
}

// Fill the buffer with the values that define a cube.
function setGeometry(gl) {
  var positions = new Float32Array(
    [
    -0.5, -0.5,  -0.5,
    -0.5,  0.5,  -0.5,
     0.5, -0.5,  -0.5,
    -0.5,  0.5,  -0.5,
     0.5,  0.5,  -0.5,
     0.5, -0.5,  -0.5,

    -0.5, -0.5,   0.5,
     0.5, -0.5,   0.5,
    -0.5,  0.5,   0.5,
    -0.5,  0.5,   0.5,
     0.5, -0.5,   0.5,
     0.5,  0.5,   0.5,

    -0.5,   0.5, -0.5,
    -0.5,   0.5,  0.5,
     0.5,   0.5, -0.5,
    -0.5,   0.5,  0.5,
     0.5,   0.5,  0.5,
     0.5,   0.5, -0.5,

    -0.5,  -0.5, -0.5,
     0.5,  -0.5, -0.5,
    -0.5,  -0.5,  0.5,
    -0.5,  -0.5,  0.5,
     0.5,  -0.5, -0.5,
     0.5,  -0.5,  0.5,

    -0.5,  -0.5, -0.5,
    -0.5,  -0.5,  0.5,
    -0.5,   0.5, -0.5,
    -0.5,  -0.5,  0.5,
    -0.5,   0.5,  0.5,
    -0.5,   0.5, -0.5,

     0.5,  -0.5, -0.5,
     0.5,   0.5, -0.5,
     0.5,  -0.5,  0.5,
     0.5,  -0.5,  0.5,
     0.5,   0.5, -0.5,
     0.5,   0.5,  0.5,

    ]);
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
}

main();

// http://media.tojicode.com/webgl-samples/root/texture/lena_dxt5.dds