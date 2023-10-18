function calcDateDiff (endDate, currentDate, totalInterval) {
  var percentTimeDone = (1 - ((endDate - currentDate) / totalInterval)) * 100;
  $("#percentComp").text(percentTimeDone);
  return percentTimeDone;
}

function daysDifferential (firstPoint, secondPoint) {
  return convertToDays(secondPoint - firstPoint);
}

function convertToDays (num) {
  return num / 86400000;
}

function progressbar (endDate, currentDate, totalInterval) {
  $(function() {
    $( "#progressbar" ).progressbar({
      value: calcDateDiff(endDate, currentDate, totalInterval)
    });
  });
}

function updateCounts (){
  var startDate     =   1346472000000;
      currentDate   =   new Date(),
      endDate       =   1355428800000;
      totalInterval =   9075600000;

  progressbar(endDate, currentDate, totalInterval); //draw prog bar
  $("#daysComp").text(daysDifferential(startDate,currentDate));
  $("#daysLeft").text(daysDifferential(currentDate,endDate));
}
updateCounts();
setInterval(updateCounts, 1000);