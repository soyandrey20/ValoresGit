const { Board, Sensor, Led } = require("johnny-five");
const http = require("http");
const axios = require('axios');

const board = new Board();

const threshold = 500;
const readingsToAverage = 10; // Número de lecturas para promediar
const intervalBetweenReadings = 1500; // Intervalo entre lecturas en milisegundos
let sensor, led;
let readings = [];
let sum = 0;
let paused = true; // Modo espera activado por defecto

board.on("ready", () => {
  sensor = new Sensor("A0");
  led = new Led(13);

  // Función para realizar una lectura del sensor y controlar el LED
  function readSensorAndControlLED() {
    console.log("Sensor value: ", sensor.value);
    readings.push(sensor.value);
    sum += sensor.value;

    if (sensor.value > threshold) {
      console.log("Obstáculo detectado");
      led.on();
    } else {
      console.log("No hay obstáculo");
      led.off();
    }
  }

  // Función para enviar el promedio de las lecturas a la API
  function sendAverageToAPI() {
    const average = sum / readings.length;
    console.log(`Promedio de las lecturas: ${average}`);

    // Enviar el promedio a la API usando axios
    axios.post('http://localhost:3000/AgregarValor', { valor: average })
      .then(response => {
        console.log('Respuesta de la API:', response.data); // Manejar la respuesta exitosa (opcional)
        paused = true; // Activar modo espera después de enviar datos
      })
      .catch(error => {
        console.error('Error al enviar datos a la API:', error); // Manejar errores
      });

    // Reiniciar las lecturas y la suma para el próximo intervalo
    readings = [];
    sum = 0;
  }

  // Crear un bucle de lectura del sensor y control del LED a intervalos cortos
  setInterval(() => {
    if (!paused) {
      for (let i = 0; i < readingsToAverage; i++) {
        setTimeout(readSensorAndControlLED, i * intervalBetweenReadings);
      }
      setTimeout(sendAverageToAPI, readingsToAverage * intervalBetweenReadings);
    }
  }, readingsToAverage * intervalBetweenReadings);

  // Crear un servidor HTTP para leer los datos del sensor y reanudar el proceso
  http.createServer((req, res) => {
    if (req.url === "/read-sensor") {
      paused = false; // Reanudar el proceso de lectura y envío de datos
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("Lectura del sensor y proceso reanudado.");

      // Inmediatamente iniciar la lectura y el envío de datos
      for (let i = 0; i < readingsToAverage; i++) {
        setTimeout(readSensorAndControlLED, i * intervalBetweenReadings);
      }
      setTimeout(sendAverageToAPI, readingsToAverage * intervalBetweenReadings);
    } else {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Endpoint no encontrado.");
    }
  }).listen(3008, () => {
    console.log("Servidor escuchando en el puerto 3008...");
  });
});
