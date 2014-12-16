// FIXME
var colKeyPrefix = "gsx$";
var gDataKey = "$t";
var columnNames = {
  tempId: colKeyPrefix + "tempid",
  eventName: colKeyPrefix + "event",
  tier: colKeyPrefix + "highesttier",
  channel: colKeyPrefix + "channel",
  startDate: colKeyPrefix + "startdate",
  endDate: colKeyPrefix + "enddate",
  location: colKeyPrefix + "location",
  description: colKeyPrefix + "description",
  relatedlinks: colKeyPrefix + "relatedlinks"
};

// shortlists and maps the corresponding fields that we want to display in the Details section
// order matters
var detailFields = [
  { key: "location", fieldName: "Location" },
  { key: "startDate", fieldName: "Start" },
  { key: "endDate", fieldName: "End" },
  { key: "tier", fieldName: "Tier" },
  { key: "channel", fieldName: "Channels" },
  { key: "description", fieldName: "Description" },
  { key: "relatedlinks", fieldName: "Related Links" }
];


var sourceUrl = "http://spreadsheets.google.com/feeds/list/1_d7X39xt169n8ST25OwO_BKMYIWm1rB5ywQ8Tb0iGKc/od6/public/values?alt=json";
var spreadsheetData = {};
var vizAllEvents = [];
var vizEventsByTier = {
    0: [],
    1: [],
    2: [],
    3: [],
    4: []
};
var monthAbbr = [ "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec" ];

var viz = $("#calendar-viz");
var vizTier = $("#calendar-viz-tier");
var rowHeight = "18px";

function VizEvent(gEvent) {
  // FIXME: make sure things are using the right type
  this["id"] = vizAllEvents.length + 1; // assign real id for future reference, starts from 1
  for ( key in columnNames ) {
    var gColumnKey = columnNames[key];
    this[key] = gEvent[gColumnKey][gDataKey];
    if ( key == "startDate" || key == "endDate") {
      this[key] = new Date( gEvent[gColumnKey][gDataKey] );
    }
  }
}

$.ajax({
  url: sourceUrl,
  jsonpCallback: "jsonCallback",
  contentType: "application/json",
  dataType: "jsonp",
  error: function(jqXHR, textStatus, errorThrown) {
    console.log("Failed to load Google spreadsheet data...");
    console.log(jqXHR);
  },
  success: function(data) {
    console.log("Successfully loaded Google spreadsheet data!");
    spreadsheetData = data;
    mapGData(spreadsheetData);
  },
  complete: function() {
    console.log("Finished loading spreadsheet data!");
  }
});


function mapGData(data) {
  var gEvents = data.feed.entry;
  gEvents.forEach(function(gEvent){
    var vizEvent = new VizEvent(gEvent);
    vizAllEvents.push(vizEvent);
    vizEventsByTier[vizEvent["tier"]].push( vizEvent );
  });
  delete vizEventsByTier[0]; // FIXME: we don't care about showing Tier 0
  buildTable();
}


function buildTable() {
  // build main viz
  drawHeader();
  for ( tier in vizEventsByTier ) {
    var tierGroup = vizEventsByTier[tier];
    tierGroup.forEach(function(theEvent){
      drawRow(theEvent, tier);
    });
    viz.find("tr[data-tier="+ tier +"]:last").addClass("tier-divider");
  }
  // build vertical header ( Tier Labels )
  for ( tier in vizEventsByTier ) {
    drawTierHeaders(tier);
  }
  // Add event handlers
  addVizEventHandler();
  addTierEventHandler();
}

function drawTierHeaders(tier) {
  var allRowsInTier = $("#calendar-viz tbody tr[data-tier="+ tier +"]");
  var height = 0;
  $.each(allRowsInTier,function(i,row){
    height += $(row).height();
  })
  $("<div>"+ tier +"</div>")
      .addClass("tier-header")
      .attr("style", "height: " + height + "px; line-height:" + height + "px")
      .attr("data-height", height + "px")
      .attr("data-tier", tier)
      .appendTo( vizTier );
}

function drawHeader() {
  // FIXME: make use of <col>
  var colGroupHtml = "";
  var headerHtml = "";
  // build colGroup and headerHtml
  colGroupHtml += ""
  headerHtml = "";
  for (var i=0; i<12; i++) {
    colGroupHtml += "<col class='month " + monthAbbr[i] + "'></col>";
    headerHtml += "<th>" + monthAbbr[i] + "</th>";
  }
  colGroupHtml += "<col class='event-col'></col>";
  headerHtml += "<th class='event-name'></th>";
  // insert to DOM
  viz.find("thead").before("<colgroup>"+ colGroupHtml + "</colgroup>")
                   .prepend("<tr>"+ headerHtml + "</tr>");
}


function drawRow(theEvent, tier) {
  var rowHtml = "";
  var month = theEvent.startDate.getMonth(); // index starts from 0
  // find and mark event month slot
  for (var i=0; i<12; i++) {
    if ( i == month ) {
      rowHtml += "<td class='month marked'><div class='dot'></div></td>"
    }else {
      rowHtml += "<td class='month'></td>";
    }
  }
  // disply event name
  rowHtml += "<td class='event-name'>"+ theEvent["eventName"] +"</td>";
  viz.find("tbody").append("<tr data-id=" +  theEvent.id + " data-tier=" + tier + ">" +
                                        rowHtml +
                                  "</tr>");
}



// ==================

function addVizEventHandler() {
  // show Event description
  viz.find("tbody").find(".dot, .event-name").click(showDetails);
  viz.find("tbody").find("tr").hover(highlightRow);
}

function addTierEventHandler() {
  // toggle each Tier section
  vizTier.find("div.tier-header").click(toggleTier);
}


// Show Event description click handler
function showDetails(event) {
  viz.find("tr[data-id].selected").removeClass("selected");
  // get currently selected Event
  var id = $(this).parents("tr[data-id]").addClass("selected").attr("data-id");
  var selected = vizAllEvents[(id-1)];
  // update content
  var newContent = "";
  for ( var i=0; i<detailFields.length; i++ ) {
    var key = detailFields[i].key;
    var fieldName = detailFields[i].fieldName;
    var fieldContent = selected[key];
    var listItem = "";

    if ( fieldContent == "" ) {
      continue; // skip if no content
    }

    if ( key == "channel") {
      listItem = "<li><b class='desc-label'>" + fieldName + "</b><br>";
      var channels = selected[key].split(",");
      for (var j=0; j<channels.length; j++) {
        listItem += channels[j] + "<br>";
      }
      listItem += "</li>";
    } else if ( key == "relatedlinks" ) {
      listItem = "<li><b class='desc-label'>" + fieldName + "</b>";
      var links = selected[key].split(",");
      for (var j=0; j<links.length; j++) {
        if ( j != 0 ) { listItem += "," }
        listItem += "<a href='" + links[j] + "'>" + links[j] + "<a>";
      }
      listItem += "</li>";
    } else {
      listItem =  "<li>" +
                    "<b class='desc-label'>" + fieldName + "</b>" + fieldContent +
                  "</li>";
    }
    newContent += listItem;
  }

  $("#event-title").text(selected.eventName);
  $("#event-details").fadeOut(500,function() {
    $(this).html(newContent);
  }).fadeIn(800);
}

function highlightRow(event) {
  $(event.target).parents("tr").toggleClass("row-hover");
  $(event.target).parents("tr").find("*:not(.dot)").toggleClass("row-hover");
}


// Toggle Tier click handler
function toggleTier(event) {
  var tier = $(event.target).attr("data-tier");
  // main viz
  viz.find("tr[data-tier="+ tier +"]:not(:last)").toggle();
  viz.find("tr[data-tier="+ tier +"]:last *").toggle();
  // tier viz ("vertical header")
  var tierHeader = vizTier.find("div[data-tier="+ tier +"]");
  var height = tierHeader.attr("data-height");
  tierHeader.toggleClass("collapsed");
  if ( tierHeader.hasClass("collapsed") ) {
    tierHeader.css({"height": rowHeight, "line-height": rowHeight});
  }else {
    tierHeader.css({"height": height, "line-height": height});
  }
}


// Redraw vertical header if Window has been resized
$(window).resize(function() {
  vizTier.html(""); // reset
  for ( tier in vizEventsByTier ) {
    drawTierHeaders(tier);
  }
  addTierEventHandler();
});

