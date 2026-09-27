"use strict";

var canvas;
var gl;

var points = [];
var NumTimesToSubdivide = 3;
var MAX_LEVEL = 6;   // 8^6 = 262,144개. 이보다 크면 한 칸이 1픽셀보다 작아진다

// 여러 함수에서 쓰도록 전역으로 옮긴 것들
var bufferId;
var vPosition;

window.onload = function init()
{
    canvas = document.getElementById( "gl-canvas" );

    gl = WebGLUtils.setupWebGL( canvas );
    if ( !gl ) { alert( "WebGL isn't available" ); }

    gl.viewport( 0, 0, canvas.width, canvas.height );
    gl.clearColor( 1.0, 1.0, 1.0, 1.0 );

    var program = initShaders( gl, "vertex-shader", "fragment-shader" );
    gl.useProgram( program );

    // 버퍼는 처음에 한 번만 만든다. 내용은 buildCarpet()에서 채운다
    bufferId = gl.createBuffer();
    gl.bindBuffer( gl.ARRAY_BUFFER, bufferId );

    vPosition = gl.getAttribLocation( program, "vPosition" );
    gl.vertexAttribPointer( vPosition, 2, gl.FLOAT, false, 0, 0 );
    gl.enableVertexAttribArray( vPosition );

    setupUI();
    buildCarpet();
};

// 분할 횟수가 바뀔 때마다 호출: 정점을 새로 만들어 버퍼에 다시 올린다
function buildCarpet()
{
    points = [];   // 이전 단계의 정점을 비우지 않으면 계속 쌓인다

    var a = vec2( -0.9, -0.9 );
    var c = vec2(  0.9,  0.9 );
    divideSquare( a, c, NumTimesToSubdivide );

    gl.bindBuffer( gl.ARRAY_BUFFER, bufferId );
    gl.bufferData( gl.ARRAY_BUFFER, flatten( points ), gl.STATIC_DRAW );

    render();
}

function square( a, c )
{
    var b = vec2( c[0], a[1] );
    var d = vec2( a[0], c[1] );

    points.push( a, b, c );
    points.push( a, c, d );
}

function divideSquare( a, c, count )
{
    if ( count === 0 ) {
        square( a, c );
        return;
    }

    var w = ( c[0] - a[0] ) / 3;
    var h = ( c[1] - a[1] ) / 3;

    for ( var row = 0; row < 3; ++row ) {
        for ( var col = 0; col < 3; ++col ) {
            if ( row === 1 && col === 1 ) continue;

            var subA = vec2( a[0] + col * w,       a[1] + row * h );
            var subC = vec2( a[0] + (col + 1) * w, a[1] + (row + 1) * h );

            divideSquare( subA, subC, count - 1 );
        }
    }
}


function setupUI()
{
    var slider = document.getElementById( "level" );

    // 슬라이더를 움직이는 동안 계속 반영
    slider.addEventListener( "input", function () {
        setLevel( parseInt( slider.value ) );
    });

    document.getElementById( "levelDown" ).onclick = function () {
        setLevel( NumTimesToSubdivide - 1 );
    };
    document.getElementById( "levelUp" ).onclick = function () {
        setLevel( NumTimesToSubdivide + 1 );
    };
}

function setLevel( n )
{
    // 0 ~ MAX_LEVEL 범위를 벗어나지 않게 고정
    n = Math.max( 0, Math.min( MAX_LEVEL, n ) );

    // 같은 값이면 다시 계산하지 않는다 (6단계는 계산이 무겁다)
    if ( n === NumTimesToSubdivide ) return;

    NumTimesToSubdivide = n;
    document.getElementById( "level" ).value = n;
    document.getElementById( "levelText" ).textContent = n;

    buildCarpet();
}

function render()
{
    gl.clear( gl.COLOR_BUFFER_BIT );
    gl.drawArrays( gl.TRIANGLES, 0, points.length );
}