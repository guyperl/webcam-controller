import 'styles/index.scss';
import Rx from 'rxjs/Rx';

const MOTION = {
  up: Symbol('UP'),
  down: Symbol('DOWN'),
  left: Symbol('LEFT'),
  right: Symbol('RIGHT'),
  none: Symbol('NONE')
};

const MOVE_THRESHOLD = 5;
const VIDEO_WIDTH = 640;
const MOVEMENT_THROTTLE_TIME = 100;
const MOVEMENT_BUFFER_TIME = 300;

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
      const width = VIDEO_WIDTH;
      const height = video.videoHeight / (video.videoWidth / width);
      video.setAttribute('width', width);
      video.setAttribute('height', height);
      canvas.setAttribute('width', width);
      canvas.setAttribute('height', height);

      return { video, canvas, height, width };
    });

  return Rx.Observable
    .zip(getUserMediaObservable, playObservable)
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
  if (Math.abs(dy) > MOVE_THRESHOLD) {
    y = dy > 0 ? MOTION.down : MOTION.up;
  } else {
    y = MOTION.none;
  }

  let x;
  const dx = position.x - positionOld.x;
  if (Math.abs(dx) > MOVE_THRESHOLD) {
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

function getMostOccurringMove(movesCollection) {
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
    .interval(0, MOVEMENT_THROTTLE_TIME)
    .takeWhile(isVideoReady)
    .map(() => detect(video, detector))
    .map(coordinates => {
      draw(video, canvas, context, coordinates);
      return coordinates;
    })
    .pairwise()
    .filter(([coordinatesOld, coordinates]) => coordinatesOld && coordinates)
    .map(([coordinatesOld, coordinates]) => getDirection(coordinatesOld, coordinates))
    .bufferTime(MOVEMENT_BUFFER_TIME)
    .map(positions => {
      const { xMoves, yMoves } = positions.reduce(({xMoves, yMoves}, [x, y]) => {
        return { xMoves: xMoves.concat(x), yMoves: yMoves.concat(y) };
      }, { xMoves: [], yMoves: [] });

      return {
        horizontal: getMostOccurringMove(xMoves),
        vertical: getMostOccurringMove(yMoves)
      };
    })
    .filter(({ horizontal, vertical }) => horizontal || vertical);
}

function start() {
  initialize()
    .map(({ video, canvas, context }) =>
      ({ video, canvas, context, detector: createDetector(video) }))
    .flatMap(media => detectMotion(media))
    .subscribe(motion => {
      const horizontalMoveViewValue = getDirectionViewValue(motion.horizontal);
      const verticalMoveViewValue = getDirectionViewValue(motion.vertical);

      if (horizontalMoveViewValue) {
        console.log('HORIZONTAL:', getDirectionViewValue(motion.horizontal), '\n');
      }

      if (verticalMoveViewValue) {
        console.log('VERTICAL:', getDirectionViewValue(motion.vertical), '\n');
      }

      if (horizontalMoveViewValue || verticalMoveViewValue) {
        console.log('\n');
      }
    });
}

window.addEventListener('load', start);
