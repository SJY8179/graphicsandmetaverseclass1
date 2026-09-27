"use strict";

var canvas;
var gl;

window.onload = function init()
{
    canvas = document.getElementById( "gl-canvas" );

    // WebGL 컨텍스트 얻기. 실패하면 브라우저가 WebGL을 지원하지 않는 것
    gl = WebGLUtils.setupWebGL( canvas );
    if ( !gl ) { alert( "WebGL isn't available" ); }

    // 캔버스 전체를 그림 영역으로 사용하고, 지울 때 쓸 배경색 지정
    gl.viewport( 0, 0, canvas.width, canvas.height );
    gl.clearColor( 1.0, 1.0, 1.0, 1.0 );

    // shader 읽기 → 컴파일 → 프로그램 객체에 연결 (initShaders.js가 대신 해줌)
    var program = initShaders( gl, "vertex-shader", "fragment-shader" );
    gl.useProgram( program );

    render();
};

function render()
{
    gl.clear( gl.COLOR_BUFFER_BIT );
}