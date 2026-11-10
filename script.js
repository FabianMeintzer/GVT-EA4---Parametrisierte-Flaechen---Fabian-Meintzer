// globale Variablen
var canvas, gl;

// Datentabellen
var vertices, colors, indicesLines, indicesTris;

// Buffer-Objekte
var vboPos, vboCol, iboLines, iboTris;
var posAttrib, colAttrib;

// Aktuelle Auswahl
var currentSurface = 'funnel';
var currentMode = 'wire';

// Ansicht: Drehung um die y-Achse (alpha) und Kippen um die x-Achse (beta)
var alpha = 0.55, beta = 0.55;
var alphaStart = 0.55, betaStart = 0.55;
var drehSchritt = 0.2;

// Einheitliche Farbe der Gitterlinien (dunkelblau)
var linienFarbe = [0.04, 0.08, 0.3, 1];

var flaechen = {

  // 1) Funnel (Trichter) http://www.3d-meier.de/tut3/Seite27.html
  //    x = u*cos(v),
  //     y = u*sin(v), 
  //    z = log(u)
  //    u in [0.1, 2],
  //    v in [0, 2*pi]

  funnel: {
    name: 'Funnel (Trichter)',
    formel: 'x = u &middot; cos(v)<br>y = u &middot; sin(v)<br>z = ln(u)',
    bereich: 'u &isin; [0,1&nbsp;&hellip;&nbsp;2] &nbsp;&nbsp; v &isin; [0, 2&pi;]',
    umin: 0.1, umax: 2.0, vmin: 0.0, vmax: 2.0*Math.PI,
    n: 24, m: 64,   // n Unterteilungen in u-Richtung, m in v-Richtung
    text: 'Der Radius wächst mit u, die Höhe folgt dem natürlichen Logarithmus '
        + 'ln(u). Kleine u-Werte liegen dadurch tief und eng beieinander (dünner '
        + 'Hals), grosse u-Werte weit oben und weit aussen (offener Trichterrand). ',
    point: function(u, v) {
      return [ u * Math.cos(v),   // x
               Math.log(u),       // Höhe (y im Bild) = z der Vorgabe
               u * Math.sin(v) ]; // Tiefe (z im Bild) = y der Vorgabe
    },
    color: function(u, v, p) {
      // Höhe auf 0..1 normieren, danach Farbe interpolieren
      var t = (Math.log(u) - Math.log(0.1)) / (Math.log(2) - Math.log(0.1));
      return farbeMischen([0.05, 0.1, 0.5], [0.35, 0.95, 0.8], t);
    }
  },

  // 2) Sinuswelle http://www.3d-meier.de/tut3/Seite127.html
  //    x = u,
  //    y = a*sin(b*sqrt(u² + v²)),
  //    z = v
  //    u in [-15, 15], 
  //    v in [-15, 15]
  //    Die Konstanten a (Amplitude) und b (Wellenzahl) bestimmen das
  //    Aussehen der Figur; hier wird a = 6 und b = 0.6 verwendet.

  sinus: {
    name: 'Sinuswelle',
    formel: 'x = u<br>y = a &middot; sin(b &middot; &radic;(u&sup2; + v&sup2;))<br>z = v'
          + '<br><span class="klein">mit a = 6, b = 0.6</span>',
    bereich: 'u &isin; [&minus;15, 15] &nbsp;&nbsp; v &isin; [&minus;15, 15]',
    umin: -15.0, umax: 15.0, vmin: -15.0, vmax: 15.0,
    n: 64, m: 64,
    text: 'x = u und z = v übernehmen die beiden Parameter unverändert, nur die Höhe y wird verschoben. '
        + 'Der Ausdruck &radic;(u&sup2;+v&sup2;) ist der Abstand zum Ursprung, '
        + 'deshalb entstehen kreisförmige Wellenringe wie im Wasser. Ein grosses '
        + 'a macht die Welle höher, ein grosses b legt mehr Ringe nebeneinander. ',
    point: function(u, v) {
      var a = 6.0, b = 0.6;
      return [ u,                                       // x
               a * Math.sin(b * Math.sqrt(u*u + v*v)),  // Höhe
               v ];                                     // Tiefe
    },
    color: function(u, v, p) {
      var t = (p[1] / 6.0 + 1) / 2;   // Auslenkung -6..+6 auf 0..1 bringen
      return farbeMischen([0.05, 0.15, 0.6], [1.0, 0.45, 0.1], t);
    }
  },


  // 3) Trichterwelle - eigene Kreation
  //    Mischung aus Trichter und Sinuswelle
  //    Angepasste Formel: Höhe des Funnel überlagert mit einer Sinuswelle,
  //    deren Amplitude mit dem Radius u wächst
  //    x = u*cos(v),
  //    y = u*sin(v),
  //    z = log(u) + 0.25*u*sin(4*v)
  //    u in [0.1, 2],
  //    v in [0, 2*pi]

  eigen: {
    name: 'Trichterwelle (Eigenkreation, Trichter + (Sinus-)welle)',
    formel: 'x = u &middot; cos(v)<br>y = u &middot; sin(v)<br>'
          + 'z = ln(u) + 0.25 &middot; u &middot; sin(4&middot;v)',
    bereich: 'u &isin; [0,1&nbsp;&hellip;&nbsp;2] &nbsp;&nbsp; v &isin; [0, 2&pi;]',
    umin: 0.1, umax: 2.0, vmin: 0.0, vmax: 2.0*Math.PI,
    n: 24, m: 64,
      text: 'Die Höhenfunktion des Trichters z = ln(u) bleibt unverändert '
        + 'erhalten und wird um einen Sinus-Term über dem Winkel v ergänzt. Die '
        + 'Wellenidee der Sinuswelle (y = a·sin(b·√(u²+v²))) wird also vom Abstand '
        + 'zum Ursprung auf den Winkel um die Achse übertragen. Die 4 in '
        + 'sin(4·v) erzeugt vier Wellenberge und vier Wellentäler. Die Amplitude '
        + '0.25·u wächst mit dem Radius: weit unten am dünnen Hals (u = 0,1) ist '
        + 'die Welle kaum zu spüren, oben am offenen Rand (u = 2) schlägt sie mit '
        + '0,5 von 3 Einheiten Höhe aus. Deshalb bleibt der Trichter als Grundform '
        + 'erkennbar und der Rand wirkt wie ein Wellblechring.',
    point: function(u, v) {
      return [ u * Math.cos(v),                            // x
               Math.log(u) + 0.25*u*Math.sin(4*v),         // Höhe
               u * Math.sin(v) ];                          // Tiefe
    },
    color: function(u, v, p) {
      // Farbkreis: drei um je 120 Grad (2*pi/3) versetzte Cosinus-Kurven
      var rot   = 0.5 + 0.5 * Math.cos(v);
      var gruen = 0.5 + 0.5 * Math.cos(v - 2.094);
      var blau  = 0.5 + 0.5 * Math.cos(v + 2.094);
      // Farbe etwas entschärfen: Anteil der mittleren Helligkeit beimischen
      var mitte = (rot + gruen + blau) / 3;
      rot   = 0.7*rot   + 0.3*mitte;
      gruen = 0.7*gruen + 0.3*mitte;
      blau  = 0.7*blau  + 0.3*mitte;
      // Höhe (etwa -2.3 bis +1.2) auf 0..1 bringen und unten abdunkeln
      var t = (p[1] + 2.3) / 3.5;
      var hell = 0.45 + 0.55 * Math.max(0, Math.min(1, t));
      return [rot*hell, gruen*hell, blau*hell];
    }
  }
};

//  Hilfsfunktionen

// Lineare Mischung (Interpolation) zweier Farben: t = 0 -> c1, t = 1 -> c2
function farbeMischen(c1, c2, t) {
  var c = [0, 0, 0];
  for (var i = 0; i < 3; i++) {
    c[i] = c1[i] + (c2[i] - c1[i]) * t;
  }
  return c;
}

// Shader-Quelle in einen Shader übersetzen und an das Programm anhängen
function createShader(gl, type, source) {
  var shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  gl.attachShader(prog, shader);
}

// Vertex-Shader: Position und Farbe durchreichen
var vsSource = '' +
  'attribute vec3 pos;' +
  'attribute vec4 col;' +
  'varying vec4 color;' +
  'void main(){' +
  '  color = col;' +
  '  gl_Position = vec4(pos, 1);' + '}';

// Fragment-Shader: interpolierte Farbe
var fsSource = '' +
  'precision mediump float;' +
  'varying vec4 color;' +
  'void main() {' +
  '  gl_FragColor = color;' +
  '}';

var prog;


//  Initialisierung
function init() {
  canvas = document.getElementById('canvas');
  gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

  gl.clearColor(.95, .95, .95, 1);
  gl.disable(gl.CULL_FACE);
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.enable(gl.POLYGON_OFFSET_FILL);
  gl.polygonOffset(1.0, 1.0);

  prog = gl.createProgram();
  createShader(gl, gl.VERTEX_SHADER, vsSource);
  createShader(gl, gl.FRAGMENT_SHADER, fsSource);
  gl.linkProgram(prog);
  gl.useProgram(prog);

  posAttrib = gl.getAttribLocation(prog, 'pos');
  colAttrib = gl.getAttribLocation(prog, 'col');

  vboPos   = gl.createBuffer();
  vboCol   = gl.createBuffer();
  iboLines = gl.createBuffer();
  iboTris  = gl.createBuffer();

  // Tastatur: Pfeiltasten drehen und kippen
  window.onkeydown = function(evt) {
    var key = evt.which ? evt.which : evt.keyCode;
    if (key == 37) { alpha -= drehSchritt; }        // Pfeil links
    else if (key == 39) { alpha += drehSchritt; }   // Pfeil rechts
    else if (key == 38) { beta  += drehSchritt; }   // Pfeil hoch: mehr Draufsicht
    else if (key == 40) { beta  -= drehSchritt; }   // Pfeil runter: flacher
    else if (key == 82) { resetView(); }            // Taste R
    else { return; }                                // andere Tasten ignorieren
    evt.preventDefault();
    neuBerechnen();
  };

  selectSurface('funnel');
}

//  Geometrie erzeugen
function createVertexData(s) {
  var n = s.n;   // Unterteilungen in u-Richtung
  var m = s.m;   // Unterteilungen in v-Richtung

  vertices     = new Float32Array(3 * (n+1) * (m+1));
  colors       = new Float32Array(4 * (n+1) * (m+1));
  indicesLines = new Uint16Array(2 * 2 * n * m);
  indicesTris  = new Uint16Array(3 * 2 * n * m);

  // Schrittweiten der beiden Parameter
  var du = (s.umax - s.umin) / n;
  var dv = (s.vmax - s.vmin) / m;

  // Zähler für die Index-Felder
  var iLine = 0;
  var iTri  = 0;

  // 1. Durchlauf: grössten Abstand aller Punkte zum Ursprung suchen
  var maxLen = 0;
  for (var i = 0, u = s.umin; i <= n; i++, u += du) {
    for (var j = 0, v = s.vmin; j <= m; j++, v += dv) {
      var p = s.point(u, v);
      var len = Math.sqrt(p[0]*p[0] + p[1]*p[1] + p[2]*p[2]);
      if (len > maxLen) { maxLen = len; }
    }
  }
  var scale = 0.98 / maxLen;

  // Winkel der Ansicht vorhalten
  var ca = Math.cos(alpha), sa = Math.sin(alpha);
  var cb = Math.cos(beta),  sb = Math.sin(beta);

  // 2. Durchlauf: Positionen, Farben und Indizes füllen
  for (i = 0, u = s.umin; i <= n; i++, u += du) {
    for (j = 0, v = s.vmin; j <= m; j++, v += dv) {

      // laufender Index des Vertex im Netz
      var iVertex = i * (m+1) + j;

      var p = s.point(u, v);

      // Drehung um die y-Achse (Drehung der Ansicht)
      var x =  p[0]*ca + p[2]*sa;
      var z = -p[0]*sa + p[2]*ca;
      var y =  p[1];

      // Kippen um die x-Achse, dadurch sieht man von schräg oben auf die Fläche
      var y2 = y*cb - z*sb;
      var z2 = y*sb + z*cb;

      // Positionen (skaliert in den Bereich -1 .. +1)
      vertices[iVertex * 3]     = x * scale;
      vertices[iVertex * 3 + 1] = y2 * scale;
      vertices[iVertex * 3 + 2] = z2 * scale;

      // Farbe des Vertex (wird auf den Dreiecken interpoliert -> Farbverlauf)
      var c = s.color(u, v, p);
      colors[iVertex * 4]     = c[0];
      colors[iVertex * 4 + 1] = c[1];
      colors[iVertex * 4 + 2] = c[2];
      colors[iVertex * 4 + 3] = 1;

      // Indizes: Linien und Dreiecke
      // Erste Zeile/Spalte hat noch keine Nachbarn, dort werden keine Maschen erzeugt
      if (j > 0 && i > 0) {

        // Linie in v-Richtung (auf der Kurve des Parameters u)
        indicesLines[iLine++] = iVertex - 1;
        indicesLines[iLine++] = iVertex;
        // Linie in u-Richtung (auf der Kurve des Parameters v)
        indicesLines[iLine++] = iVertex - (m+1);
        indicesLines[iLine++] = iVertex;

        // Zwei Dreiecke füllen eine Masche
        indicesTris[iTri++] = iVertex;
        indicesTris[iTri++] = iVertex - 1;
        indicesTris[iTri++] = iVertex - (m+1);
        //
        indicesTris[iTri++] = iVertex - 1;
        indicesTris[iTri++] = iVertex - (m+1) - 1;
        indicesTris[iTri++] = iVertex - (m+1);
      }
    }
  }
}

// Daten in die GPU-Buffer schreiben
function uploadVertexData() {
  // Positionen
  gl.bindBuffer(gl.ARRAY_BUFFER, vboPos);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
  gl.vertexAttribPointer(posAttrib, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(posAttrib);

  // Farben
  gl.bindBuffer(gl.ARRAY_BUFFER, vboCol);
  gl.bufferData(gl.ARRAY_BUFFER, colors, gl.STATIC_DRAW);
  gl.vertexAttribPointer(colAttrib, 4, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(colAttrib);

  // Index-Buffer für Linien
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, iboLines);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indicesLines, gl.STATIC_DRAW);
  iboLines.numberOfElements = indicesLines.length;

  // Index-Buffer für Dreiecke
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, iboTris);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indicesTris, gl.STATIC_DRAW);
  iboTris.numberOfElements = indicesTris.length;

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
}


//  Rendern
function render() {
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  // Gefüllte Fläche: Farbe kommt aus dem Farb-Buffer (Verlauf)
  if (currentMode == 'fill' || currentMode == 'both') {
    gl.enableVertexAttribArray(colAttrib);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, iboTris);
    gl.drawElements(gl.TRIANGLES, iboTris.numberOfElements, gl.UNSIGNED_SHORT, 0);
  }

  //  Drahtgitter: konstante Farbe für alle Linien
  if (currentMode == 'wire' || currentMode == 'both') {
    gl.disableVertexAttribArray(colAttrib);
    gl.vertexAttrib4f(colAttrib, linienFarbe[0], linienFarbe[1], linienFarbe[2], linienFarbe[3]);
    gl.lineWidth(currentMode == 'wire' ? 2.0 : 1.0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, iboLines);
    gl.drawElements(gl.LINES, iboLines.numberOfElements, gl.UNSIGNED_SHORT, 0);
  }
}

//  Bedienung der Webseite (Buttons und Tastatur)

// Fläche auswählen (Button)
function selectSurface(id) {
  currentSurface = id;
  createVertexData(flaechen[id]);
  uploadVertexData();
  markierungAktualisieren();
  infosAktualisieren();
  render();
}

// Darstellungsart auswählen (Button)
function selectMode(mode) {
  currentMode = mode;
  markierungAktualisieren();
  render();
}

// Ansicht verändert: Daten neu berechnen und erneut zeichnen
function neuBerechnen() {
  createVertexData(flaechen[currentSurface]);
  uploadVertexData();
  infosAktualisieren();
  render();
}

function drehen(dir)      { alpha += dir * drehSchritt; neuBerechnen(); }
function kippen(dir)      { beta  += dir * drehSchritt; neuBerechnen(); }
function resetView()      { alpha = alphaStart; beta = betaStart; neuBerechnen(); }

// Gewählten Button hell einfärben
function knopfSetzen(id, an) {
  var knopf = document.getElementById(id);
  knopf.style.background = an ? '#2b6cb0' : '#4a5568';
  knopf.style.color = an ? '#ffffff' : '#dbe4ee';
}

function markierungAktualisieren() {
  knopfSetzen('btnFunnel', currentSurface == 'funnel');
  knopfSetzen('btnSinus',  currentSurface == 'sinus');
  knopfSetzen('btnEigen',  currentSurface == 'eigen');
  knopfSetzen('btnWire',   currentMode == 'wire');
  knopfSetzen('btnFill',   currentMode == 'fill');
  knopfSetzen('btnBoth',   currentMode == 'both');
}

// Infotext rechts nebem Canvas
function infosAktualisieren() {
  var s = flaechen[currentSurface];
  var grad = '&deg;';
  var drehung = Math.round(alpha * 180 / Math.PI);
  var neigung = Math.round(beta * 180 / Math.PI);
  var modus = 'Drahtgitter';
  if (currentMode == 'fill') { modus = 'gefüllte Fläche'; }
  if (currentMode == 'both') { modus = 'Füllung mit Drahtgitter'; }

  var html = '<h3>' + s.name;
  html += '</h3>';

  html += '<p class="formel">' + s.formel + '</p>';
  html += '<p><b>Definitionsbereich:</b> ' + s.bereich + '</p>';
  html += '<p><b>Netzdichte:</b> ' + s.n + ' &times; ' + s.m + ' Segmente, '
        + 'also ' + ((s.n+1)*(s.m+1)) + ' Vertices<br>' + '<b>Ansicht:</b> Drehung ' + drehung + grad + ', Neigung ' + neigung + grad + '</p>';
  html += '<p>' + s.text + '</p>';
  document.getElementById('info').innerHTML = html;
}


