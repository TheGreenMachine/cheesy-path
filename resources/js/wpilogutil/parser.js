let pointsToGenerate = [];
let swerveHeadings = [];
let dataAsUint8;

const kMaxVelocity = 3.75; // m/s


function makesure() {
    console.log('worked!')
}

async function handleWPILog(event) {
    const file = event.target.files[0];

    function readFileAsync(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = function (e) {
                resolve(new Uint8Array(e.target.result)); // create a Uint8Array from ArrayBuffer
            };

            reader.readAsArrayBuffer(file);
        });
    }

    dataAsUint8 = await readFileAsync(file);

    console.log(decodeWPILOG(dataAsUint8, timeFrom, (duration + timeFrom), sampleRate))
}

//Decoding 

function decodeWPILOG(logData, timeStart, timeTo, sampleRate) {
    const decoder = new WPILOGDecoder(logData);
    const poses = [];
    
    let lastPoseRecorded = [0.000,0.000,0.000];

    let headingCalculationStarted = false;

    let lastTime = 0;

    pointsToGenerate = []
    swerveHeadings = []

    decoder.forEach((record) => {
        try {
            let timestamp = record.getTimestamp() / 1000000; //Convert from microseconds to seconds
            let poseValue = record.getDoubleArray();

            if (poseValue != false && ( // If poseValue is a Double array, check if it's both a pose entry and has valid values
                poseValue.length!= 3 ||
                poseValue[0] <= 0 || 
                poseValue[1] <= 0
            )) {
                poseValue = false;
            }

            if (poseValue != false 
                && timestamp >= timeStart 
                && timestamp <= timeTo
                && timestamp - lastTime > sampleRate
                ) {
                    let velocityLegal = true;
                
                    if (poses.length) {
                        // WPILog sometimes puts in random weird values in the middle of valid ones. 
                            // using advantagescope to make the log smaller actually hurts more than it helps- removes precision
                        // So we need to make sure that all changes are physically possible in that amount of time
                        
                        let vectorDisplacement = Math.sqrt(
                            Math.pow(poseValue[0]-lastPoseRecorded[0], 2) + // ∆x^2
                            Math.pow(poseValue[1]-lastPoseRecorded[1], 2) // ∆y^2
                        )
                        let velocity = vectorDisplacement / sampleRate; // distance/time
                        
                        //TODO This check is only reliable for samplerate [0.5,1), need a better algorithm for detecting outliers
                        if (velocity > kMaxVelocity) {
                            console.log("Velocity of " + velocity + "m/s physically impossible, skipping value.")
                            velocityLegal = false;
                        } 
                    }

                    if (velocityLegal) {
                        if (headingCalculationStarted) { // Heading calculation routine
                            console.log("pushing " + poseValue[2] + " to swerveheadings: ")
                            swerveHeadings.push(poseValue[2]);

                            poseValue[2] = calcAngleBetweenPoints(lastPoseRecorded, poseValue);
                            console.log("Tank heading: " + calcAngleBetweenPoints(lastPoseRecorded, poseValue) )
                        } else { // First heading calculation
                            console.log("pushing " + poseValue[2] + "to swerveheadings.")
                            swerveHeadings.push(poseValue[2]);
                            poseValue[2] = 0;
                            console.log("1st tank heading : " + poseValue[2]);
                            headingCalculationStarted = true;
                        }

                        poses.push(fixPoseDecimals(poseValue))
                        console.log(timestamp)
                        console.log(fixPoseDecimals(poseValue))

                        lastTime = timestamp;

                        lastPoseRecorded = poseValue;
                    }
            }
            

        } catch (error) {
            // Handle decoding errors
            console.error(`Error decoding column data: ${error}`);
        }
    });

    let lastPushedPoint = [0,0]
    let pointsToPush = [];

    poses.forEach((point) => {
        if (point[0] == lastPushedPoint[0] && point[1] == lastPushedPoint[1]) { // remove duplicates
            console.log("Duplicate point " + point.join())
        } else { // push-non duplicates, update last pushed point
            console.log("Pushing point " + point.join())
            pointsToPush.push(point)
            lastPushedPoint = point;
        }
    });
    pointsToGenerate = pointsToPush; 
    
    console.log(pointsToPush)
}

//Util
function fixPoseDecimals(pose) {
    let newPose = [0,0,0];

    newPose[0] = +(pose[0].toFixed(2));
    newPose[1] = +(pose[1].toFixed(2));
    newPose[2] = +(pose[2].toFixed());

    return newPose;
}

// Waypoints visual
function showHeadingsList() {
    waypointsOutput.textContent = generateHeadingsSwerve();
    waypointsDialog.showModal();
}

function generateHeadingsSwerve() {
    console.log(swerveHeadings.join())
    return 'List.of(\n' +
        swerveHeadings.map((waypoint, i, arr) =>
            `\ Rotation2d.fromDegrees(${Math.round(waypoint)})`
            + (i === arr.length - 1 ? '' : ',')
        ).join('\n') +
        '\n)';
}

// Math

function calcAngleBetweenPoints(firstPoint, secondPoint) {
    let point = [secondPoint[0] - firstPoint[0], secondPoint[1] - firstPoint[1]]; // Vector between first and second from origin
    let result  = calcAngleDegrees(point[0],point[1]);
    return result;
}

function calcAngleDegrees(x, y) {
    return (Math.atan2(y, x) * 180) / Math.PI;
}