"use strict";

var canvas;
var gl;

var points = [];   // GPU로 보낼 정점들을 모아두는 배열

window.onload = function init()
{
    canvas = document.getElementById( "gl-canvas" );

    gl = WebGLUtils.setupWebGL( canvas );
    if ( !gl ) { alert( "WebGL isn't available" ); }

    // 초기 정사각형: 좌하단 a, 우상단 c
    // clip 좌표는 -1 ~ 1이므로 0.9로 잡아 테두리에 여백을 둔다
    var a = vec2( -0.9, -0.9 );
    var c = vec2(  0.9,  0.9 );

    square( a, c );

    gl.viewport( 0, 0, canvas.width, canvas.height );
    gl.clearColor( 1.0, 1.0, 1.0, 1.0 );

    var program = initShaders( gl, "vertex-shader", "fragment-shader" );
    gl.useProgram( program );

    // 정점 데이터를 GPU 버퍼로 전송
    var bufferId = gl.createBuffer();
    gl.bindBuffer( gl.ARRAY_BUFFER, bufferId );
    gl.bufferData( gl.ARRAY_BUFFER, flatten( points ), gl.STATIC_DRAW );

    // shader의 vPosition과 버퍼 연결: 정점 하나당 float 2개(x, y)
    var vPosition = gl.getAttribLocation( program, "vPosition" );
    gl.vertexAttribPointer( vPosition, 2, gl.FLOAT, false, 0, 0 );
    gl.enableVertexAttribArray( vPosition );

    render();
};

function square( a, c )
{
    var b = vec2( c[0], a[1] );   // 우하단
    var d = vec2( a[0], c[1] );   // 좌상단

    points.push( a, b, c );       // 삼각형 1
    points.push( a, c, d );       // 삼각형 2
}

function render()
{
    gl.clear( gl.COLOR_BUFFER_BIT );
    gl.drawArrays( gl.TRIANGLES, 0, points.length );
}