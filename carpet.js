"use strict";

var canvas;
var gl;

var points = [];               // GPU로 보낼 정점들을 모아두는 배열
var NumTimesToSubdivide = 3;   // 분할 횟수

window.onload = function init()
{
    canvas = document.getElementById( "gl-canvas" );

    gl = WebGLUtils.setupWebGL( canvas );
    if ( !gl ) { alert( "WebGL isn't available" ); }

    // 초기 정사각형: 좌하단 a, 우상단 c
    var a = vec2( -0.9, -0.9 );
    var c = vec2(  0.9,  0.9 );

    // 정사각형 하나를 바로 그리지 않고, 재귀 분할을 시작한다
    divideSquare( a, c, NumTimesToSubdivide );

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

// [4단계에서 새로 추가한 함수]
// a: 좌하단, c: 우상단, count: 앞으로 더 나눌 횟수
function divideSquare( a, c, count )
{
    // 재귀 종료 조건: 더 나눌 횟수가 없으면 이 칸을 그대로 기록하고 끝
    if ( count === 0 ) {
        square( a, c );
        return;
    }

    // 한 칸의 가로(w), 세로(h) 길이 = 전체 길이를 3등분
    var w = ( c[0] - a[0] ) / 3;
    var h = ( c[1] - a[1] ) / 3;


    //
    for ( var row = 0; row < 3; ++row ) {
        for ( var col = 0; col < 3; ++col ) {

            if ( row === 1 && col === 1 ) continue;   // 가운데 칸 제거

            // 이 칸의 좌하단(subA)과 우상단(subC) 좌표 계산
            var subA = vec2( a[0] + col * w,       a[1] + row * h );
            var subC = vec2( a[0] + (col + 1) * w, a[1] + (row + 1) * h );

            // 작은 칸을 같은 방식으로 다시 분할 (남은 횟수는 하나 줄어듦)
            divideSquare( subA, subC, count - 1 );
        }
    }
}

function render()
{
    gl.clear( gl.COLOR_BUFFER_BIT );
    gl.drawArrays( gl.TRIANGLES, 0, points.length );
}