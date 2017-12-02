import 'styles/index.scss';
import Rx from 'rxjs/Rx';

const MOTION = {
  up: Symbol('UP'),
  down: Symbol('DOWN'),
  left: Symbol('LEFT'),
  right: Symbol('RIGHT'),
  none: Symbol('NONE')
};

const moveThreshold = 20;

function initialize() {
  const video = document.getElementById('video');
  const canvas = document.getElementById('canvas');

  const getUserMediaObservable = Rx.Observable
    .fromPromise(navigator.mediaDevices.getUserMedia({ video: true, audio: false }))
    .first()
    .catch(error => {
      console.log(`Error occured: ${error}`);
    })
    .map(stream => {
      video.srcObject = stream;
      video.play();
    });

  const playObservable = Rx.Observable
    .fromEvent(video, 'canplay')
    .first()
    .map(() => {
      const width = 640;
      const height = video.videoHeight / (video.videoWidth / width);
      video.setAttribute('width', width);
      video.setAttribute('height', height);
      canvas.setAttribute('width', width);
      canvas.setAttribute('height', height);

      return { video, canvas, height, width };
    });

  return Rx.Observable
    .combineLatest(getUserMediaObservable, playObservable)
    .map(([, videoData]) => (videoData));
}

function detect(video, detector) {
  const [ detection ] = detector.detect(video, 1);
  // Check if fist was properly detected and return scaled coordinates, otherwise return undefined
  if (detection && detection[detection.length - 1] > 2) {
    const coords = detection.slice(0, 4);
    const scale = video.videoWidth / detector.canvas.width;
    return coords.map(c => c * scale);
  }
}

function draw(video, canvas, context, coordinates) {
  // Draw video overlay:
  context.drawImage(video, 0, 0, canvas.clientWidth, canvas.clientHeight);

  // Draw if fist was detected
  if (coordinates) {
    context.beginPath();
    context.lineWidth = '2';
    context.fillStyle = 'rgba(0, 255, 255, 0.5)';
    context.fillRect(...coordinates);
    context.stroke();
  }
}

function getPosition(coordinates) {
  return {
    x: (coordinates[0] + coordinates[2]) / 2,
    y: (coordinates[1] + coordinates[3]) / 2
  };
}

function createDetector(video) {
  const width = Math.round(140 * video.videoWidth / video.videoHeight);
  const height = 140;
  return new objectdetect.detector(width, height, 1.1, objectdetect.handfist);
}

function isVideoReady() {
  return video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth > 0;
}

function getDirection(coordinatesOld, coordinates) {
  const positionOld = getPosition(coordinatesOld);
  const position = getPosition(coordinates);

  let y;
  const dy = position.y - positionOld.y;
  if (Math.abs(dy) > moveThreshold) {
    y = dy > 0 ? MOTION.down : MOTION.up;
  } else {
    y = MOTION.none;
  }

  let x;
  const dx = position.x - positionOld.x;
  if (Math.abs(dx) > moveThreshold) {
    x = dy > 0 ? MOTION.left : MOTION.right;
  } else {
    x = MOTION.none;
  }

  return [ x, y ];
}

function getDirectionViewValue(direction) {
  let viewValue;
  switch (direction) {
    case MOTION.up:
      viewValue = 'up';
      break;
    case MOTION.down:
      viewValue = 'down';
      break;
    case MOTION.left:
      viewValue = 'left';
      break;
    case MOTION.right:
      viewValue = 'right';
      break;
  }

  return viewValue;
}

function getMostOccuringMove(movesCollection) {
  const { motion } = movesCollection.reduce(({ maxCount, motion, motionMap }, move) => {
    const moveCount = motionMap.get(move);
    const newMoveCount = moveCount ? moveCount + 1 : 1;
    motionMap.set(newMoveCount);

    if (newMoveCount > maxCount) {
      maxCount = newMoveCount;
      motion = move;
    }

    return { maxCount, motion, motionMap };
  }, { maxCount: 0, motion: MOTION.none, motionMap: new Map() });

  return motion;
}

function detectMotion(media) {
  const { video, canvas, detector } = media;
  const context = canvas.getContext('2d');

  return Rx.Observable
    .interval(0, Rx.Scheduler.animationFrame)
    .takeWhile(isVideoReady)
    .map(() => detect(video, detector))
    .map(coordinates => {
      draw(video, canvas, context, coordinates);
      return coordinates;
    })
    .throttleTime(100)
    .pairwise()
    .filter(([coordinatesOld, coordinates]) => coordinatesOld && coordinates)
    .map(([coordinatesOld, coordinates]) => getDirection(coordinatesOld, coordinates))
    .bufferCount(5)
    .map(positions => {
      const { xMoves, yMoves } = positions.reduce(({xMoves, yMoves}, [x, y]) => {
        return { xMoves: xMoves.concat(x), yMoves: yMoves.concat(y) };
      }, { xMoves: [], yMoves: [] });

      const xMotion = getMostOccuringMove(xMoves);
      const yMotion = getMostOccuringMove(yMoves);

      return { horizontal: xMotion, vertical: yMotion };
    })
    .filter(({ horizontal, vertical }) => horizontal || vertical);
}

function start() {
  initialize()
    .map(({ video, canvas, context }) =>
      ({ video, canvas, context, detector: createDetector(video) }))
    .flatMap(media => detectMotion(media))
    .subscribe(motion => {
      console.log(getDirectionViewValue(motion.horizontal), getDirectionViewValue(motion.vertical));
    });
}

window.addEventListener('load', start);
