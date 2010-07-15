
if(!com)
  var com={};
  
if(!com.wuxuan)
  com.wuxuan={};

if(!com.wuxuan.fromwheretowhere)
  com.wuxuan.fromwheretowhere = {};

com.wuxuan.fromwheretowhere.main = function(){
  var pub={};

  //sqlite operations:

  pub.openPlacesDatabase = function(){
       var db = Components.classes["@mozilla.org/browser/nav-history-service;1"].  
                      getService(Components.interfaces.nsPIPlacesDatabase).DBConnection;  
    return db;
  };
    
  /*type = 32, getInt32; type = 64, getInt64; type = "str", getString */
  pub.queryAll = function(statement, type, idx) {
    var children = [];
    try {
      while (statement.executeStep()) {
	if(type == "str") {
	  children.push(statement.getString(idx));
	} else if(type == 32){
	  children.push(statement.getInt32(idx));
	} else if(type == 64){
	  children.push(statement.getInt64(idx));
	} else {
	  alert("wrong type: " + type);
	}
      }
      statement.reset();
      //alert(children.length);
      return children;  
    } 
    catch (e) {
      statement.reset();
    }
  };
  
  /*type = 32, getInt32; type = 64, getInt64; type = "str", getString */
  pub.queryOne = function(statement, type, idx) {
    var id = [];
    try {
      if (statement.executeStep()) {
	if(type == "str") {
	  id = statement.getString(idx);
	} else if(type == 32){
	  id = statement.getInt32(idx);
	} else if(type == 64){
	  id = statement.getInt64(idx);
	} else {
	  alert("wrong type: " + type);
	}
	statement.reset();
	return id;
      }
    } 
    catch (e) {
      statement.reset();
    }
  };
  
  /* the url visited before are all associated with the first place_id */
  pub.getAllIdfromPlaceId = function(pid){
    var statement = pub.mDBConn.createStatement("SELECT id FROM moz_historyvisits where place_id=:pid");
    //alert("titlefromid: " + id);
    statement.params.pid=pid;
    return pub.queryAll(statement, 32, 0);
  };
    
  /* as ids are sorted, just get the next larger rowid */
  pub.getNextLargerId = function(id) {
    var statement = pub.mDBConn.createStatement("SELECT id FROM moz_historyvisits \
					    where id>:id limit 1");
    statement.params.id=id;
    return pub.queryOne(statement, 32, 0);
  };
  
  pub.getChildren = function(parentId) {
    var nextId = pub.getNextLargerId(parentId);
    //var nativeJSON = Components.classes["@mozilla.org/dom/json;1"].createInstance(Components.interfaces.nsIJSON);
    var statement;
    if(nextId!=null && nextId!=parentId+1){
      statement = pub.mDBConn.createStatement("SELECT place_id FROM moz_historyvisits where from_visit>=:id and from_visit<:nextid");
      statement.params.id=parentId;
      statement.params.nextid=nextId;
    } else {
      statement = pub.mDBConn.createStatement("SELECT place_id FROM moz_historyvisits where from_visit=:id");
      statement.params.id=parentId;
    }
    return pub.queryAll(statement, 32, 0);
  };
  
  //linear search in array, may improve if in order
  pub.addInArrayNoDup = function(pid, ls){
    if(ls.indexOf(pid)==-1){
      ls.push(pid);
    }
    return ls;
  };
  
  /* placeId: the placeId of the parent, which is unique even when this url is visited multiple times
    retrievedId: the id of the child, which correspond to the current url only
    TOOPT: use pure SQL instead of concat and dupcheck*/
  pub.getAllChildrenfromPlaceId = function(placeId) {
    var potentialchildren = [];
    var ids = pub.getAllIdfromPlaceId(placeId);
    
    for(var j = 0; j<ids.length; j++) {
      var newChildren = pub.getChildren(ids[j]);
      for(var i in newChildren){
	potentialchildren = pub.addInArrayNoDup(newChildren[i], potentialchildren);
      }
    }
    //alert(ids + "\n" + potentialchildren);
    return potentialchildren;
  };
      
    
  pub.getCurrentURI = function() {
    if(!window.opener){
      return "none";
    }
    return window.opener.getBrowser().mCurrentBrowser.currentURI.spec;
  };
  
  pub.getIdfromUrl = function(url){
    var statement = pub.mDBConn.createStatement("SELECT id FROM moz_places where url=:url");
    if(!url) {
      return null;
    }
    statement.params.url=url;
    return pub.queryOne(statement, 32, 0);
  };
  
  pub.getUrlfromId = function(id){
    var statement = pub.mDBConn.createStatement("SELECT url FROM moz_places where id=:id");
    statement.params.id=id;
    return pub.queryOne(statement, "str", 0);
  };

  pub.getTitlefromId = function(id){
    var statement = pub.mDBConn.createStatement("SELECT title FROM moz_places where id=:id");
    statement.params.id=id;
    return pub.queryOne(statement, "str", 0); 
  };
    
  pub.getAllIdfromUrl = function(url){
    var statement = pub.mDBConn.createStatement("SELECT id FROM moz_places where url=:url");
    statement.params.url=url;
    return pub.queryAll(statement, 32, 0);
  };
  
  pub.getFirstDatefromPid = function(pid){
    var statement = pub.mDBConn.createStatement("SELECT visit_date FROM moz_historyvisits where place_id=:pid");
    statement.params.pid=pid;
    return pub.queryOne(statement, 64, 0);
  };
  
  pub.getPlaceIdfromId = function(id){
    var statement = pub.mDBConn.createStatement("SELECT place_id FROM moz_historyvisits \
					    where id<=:id \
					    order by -id limit 1");
    statement.params.id=id;
    return pub.queryOne(statement, 32, 0);
  };
  
  pub.getIdfromPlaceId = function(pid){
    var statement = pub.mDBConn.createStatement("SELECT id FROM moz_historyvisits \
					    where place_id=:id");
    statement.params.id=pid;
    return pub.queryOne(statement, 32, 0);
  };
  
  // ASSUMPTION: there exists such id!
  pub.getFromVisitfromId = function(id){
    var statement = pub.mDBConn.createStatement("SELECT from_visit FROM moz_historyvisits \
					    where id=:id and from_visit!=0");
    statement.params.id=id;
    return pub.queryOne(statement, 32, 0);
  };
  
  pub.searchIdbyKeywords = function(words){
    //SELECT * FROM moz_places where title LIKE '%sqlite%';
    //NESTED in reverse order, with the assumption that the word in front is more frequently used, thus return more items in each SELECT
    var term = "";
    var subterm = "";
  
    if(words.length==1){
      term = "SELECT id FROM moz_places WHERE TITLE LIKE '%" + words[0] + "%'";
    } else {
      for(var i = words.length-1; i>=0; i--){
        if(i==words.length-1){
          subterm = "SELECT * FROM moz_places WHERE TITLE LIKE '%" + words[i] + "%'";
        } else if(i!=0){
          subterm = "SELECT * FROM (" + subterm + ") WHERE TITLE LIKE '%" + words[i] + "%'";
        } else {
          term = "SELECT id FROM (" + subterm + ") WHERE TITLE LIKE '%" + words[i] + "%'";
        }
      }
    }
    var statement = pub.mDBConn.createStatement(term);
    return pub.queryAll(statement, 32, 0);
  };
  
  pub.getParentIds = function(retrievedId){
    if(!retrievedId) {
      return null;
    }
    //when visit_type is 2 or 3: it's not from some url; if from_visit==0, not navigate from any link
    var statement = pub.mDBConn.createStatement("SELECT from_visit,visit_type FROM moz_historyvisits where place_id=:id and visit_type!=2 and visit_type!=3 and from_visit!=0");
    statement.params.id=retrievedId;
    var ids = [];
    try {
      while (statement.executeStep()) {
	//if it's redirected from somewhere, get the real id by searching again
	var type = statement.getInt32(1);
	var from = statement.getInt32(0);
	if(type==6 || type==5) {
	  var redirectSrc = pub.getFromVisitfromId(from);
	  if(redirectSrc!=null){
	    ids.push(redirectSrc);
	  }
	} else {
	  ids.push(from);
	}
      }
      statement.reset();
      //alert(id);
      return ids;
    } 
    catch (e) {
      statement.reset();
    }
  };
  //sqlite operations finish
  
  // Main Datastructure for each Node
  pub.ReferedHistoryNode = function(id, placeId, label, isContainer, isFolded, children, level) {
    var obj = new Object();
    obj.id = id;
    obj.placeId = placeId;
    obj.label = label;
    obj.isContainer = isContainer;
    obj.isFolded = isFolded;
    obj.children = children;
    obj.level = level;
    return obj;
  };
  
  // Utils functions from here
  pub.formatDate = function(intDate) {
    var myDate = new Date(intDate/1000);
    var formated = myDate.toLocaleString();
    return formated;
  };

  pub.getURLfromNode = function(treeView) {
    var sel = treeView.selection;
    var node = treeView.visibleData[sel.currentIndex];
    var url = pub.getUrlfromId(node.placeId);
    //alert("id: " + node.id + "\n" + "place_id: " + node.placeId + "\n" + url);//+"\n"+getFirstDatefromPid(node.placeid));//+"\n"+formatDate(getFirstDatefromPid(node.placeid)));
    window.open(url);
  };

  pub.splitWithSpaces = function(myString) {
    var words = myString.split(" ");
    for(var i=0; i<words.length; i++){
      if(words[i]==''){
        words.splice(i, 1);
        i--;
      }
    }
    return words;
  };

  // Utils functions finish
  pub.mDBConn = pub.openPlacesDatabase();
  
  pub.retrievedId = pub.getIdfromUrl(Application.storage.get("currentURI", false));//pub.currentURI);//com.wuxuan.fromwheretowhere.currenURI);//pub.currentURI);
  
  pub.parentIds = pub.getParentIds(pub.retrievedId);

pub.workingThread = function(threadID, item, idx) {
  this.threadID = threadID;
  this.item = item;
  this.idx = idx;
  this.result = 0;
};

pub.workingThread.prototype = {
  run: function() {
    try {
      // This is where the working thread does its processing work.
      pub.alreadyExpandedPids = [this.item.placeId];
      //CAN'T alert here!!
      this.item = pub.allChildrenfromPid(this.item);
      
      // When it's done, call back to the main thread to let it know
      // we're finished.
      
      pub.main.dispatch(new pub.mainThread(this.threadID, this.item, this.idx),
        pub.background.DISPATCH_NORMAL);
    } catch(err) {
      Components.utils.reportError(err);
    }
  },
  
  QueryInterface: function(iid) {
    if (iid.equals(Components.interfaces.nsIRunnable) ||
        iid.equals(Components.interfaces.nsISupports)) {
            return this;
    }
    throw Components.results.NS_ERROR_NO_INTERFACE;
  }
};

pub.mainThread = function(threadID, item, idx) {
  this.threadID = threadID;
  this.item = item;
  this.idx = idx;
};

pub.mainThread.prototype = {
  run: function() {
    try {
      // This is where we react to the completion of the working thread.
      pub.alreadyExpandedPids = [];
      pub.treeView.delSuspensionPoints(this.idx);
      pub.treeView.expandFromNodeInTree(this.item, this.idx);
    } catch(err) {
      Components.utils.reportError(err);
    }
  },
  
  QueryInterface: function(iid) {
    if (iid.equals(Components.interfaces.nsIRunnable) ||
        iid.equals(Components.interfaces.nsISupports)) {
            return this;
    }
    throw Components.results.NS_ERROR_NO_INTERFACE;
  }
};

pub.background = Components.classes["@mozilla.org/thread-manager;1"].getService().newThread(0);
pub.main = Components.classes["@mozilla.org/thread-manager;1"].getService().mainThread;

  pub.allChildren = function(parentNode) {
    var parentId = parentNode.id;
    var parentLevel = parentNode.level;
    var allChildrenPId = pub.getChildren(parentId);
    if(allChildrenPId == null) return null;
    //else alert(allChildrenId);
    var urls = [];
    for(var i=0; i<allChildrenPId.length; i++) {
      var thisid = pub.getIdfromPlaceId(allChildrenPId[i]);
      var potentialchildren = pub.getChildren(thisid);
      var hasChildren = (potentialchildren!=null) && (potentialchildren.length>0);
      urls.push(pub.ReferedHistoryNode(thisid, allChildrenPId[i], pub.getTitlefromId(allChildrenPId[i]), hasChildren, false, [], parentLevel+1));
    }
    return urls;
  };
  
  pub.allChildrenfromPid = function(parentNode) {
    parentNode.isFolded = true;
    var parentLevel = parentNode.level;
    var allChildrenPId = pub.getAllChildrenfromPlaceId(parentNode.placeId);
    var urls = [];

    for(var i=0; i<allChildrenPId.length; i++) {
      var thisid = pub.getIdfromPlaceId(allChildrenPId[i]);
      
      var newChildNode = pub.ReferedHistoryNode(thisid, allChildrenPId[i], pub.getTitlefromId(allChildrenPId[i]), false, false, null, parentLevel+1);
      
      //TODO: if opened node was container, get the same properties as that!     
      if(!pub.existInVisible(newChildNode)){
	newChildNode = pub.allChildrenfromPid(newChildNode);
      }

      urls.push(newChildNode);
      
    }
    parentNode.children = urls;
    parentNode.isContainer = (urls.length>0);
    return parentNode;
  };
  
  /* when detect a Pid that's expanded already, don't open again, and add it here */
  pub.alreadyExpandedPids = [];
  
  /* go through all invisible node that's expanded, if there exists dup place_id,
  add it to alreadyExpandedPids, and return true */
  pub.existInVisible = function(item) {
    var pid = item.placeId;
    if(pub.alreadyExpandedPids.indexOf(pid)!=-1){
      return true;
    }else{
      pub.alreadyExpandedPids.push(pid);
      return false;
    }
  };
  

   
  pub.nodefromPlaceid = function(pid) {
    var potentialchildren = pub.getAllChildrenfromPlaceId(pid);
    var hasChildren = (potentialchildren!=null) && (potentialchildren.length>0);
    var id = pub.getIdfromPlaceId(pid);
    return pub.ReferedHistoryNode(id, pid, pub.getTitlefromId(pid), hasChildren, false, [], 0);
  };
  
  // those without parent are also added, can't only highlight the keywords instead of the whole title?
  pub.createParentNodesCheckDup = function(pids, allPids) {
    var nodes = [];
    /* partly solve the redundant parents issue */
    var lastdup = -1;
    var findtrace = false;
    if(pids) {
    for(var i=0; i<pids.length; i++) {
      var dupidx = allPids.indexOf(pids[i]);
      //alert(dupidx + " " + lastdup + " " + findtrace);
      if(dupidx!=-1) {
	if(lastdup == false) {
	  lastdup = dupidx;
	} else if(dupidx==lastdup-1) {
	  findtrace = true;
	  lastdup = dupidx;
	  //if it's the last one and still duplicate, add it because there's no chance to check the next one
	  //so just assume the next one doesn't duplicate
	  if(i==pids.length-1){
	    nodes.push(pub.nodefromPlaceid(pids[i]));
	  }
	} else {
	  nodes.push(pub.nodefromPlaceid(pids[i]));
	  lastdup = dupidx;
	  findtrace = false;
	}
      } else {
	if(findtrace){
	  nodes.push(pub.nodefromPlaceid(pids[i-1]));
	  findtrace = false;
	}
	allPids.push(pids[i]);
	nodes.push(pub.nodefromPlaceid(pids[i]));
      }
    }
    }
    //show "no results" if nothing is found
    if(nodes.length==0){
      nodes.push(pub.ReferedHistoryNode(-1, -1, "No result found", false, false, [], 1));
    }
    return nodes;
  };
  
    // get pid from id, and then the same as createParentNodesCheckDup, only with no initial pid set to check dup
  pub.createParentNodes = function(pIds) {
    var pids = [];
    for(var i=0; i<pIds.length; i++) {
      pids = pub.addInArrayNoDup(pub.getPlaceIdfromId(pIds[i]), pids);
    }
    return pub.createParentNodesCheckDup(pids, []);
  };
  
// Main Tree definition
pub.treeView = {
  // have to separate the looks of node from the content!!!!!!
  
  visibleData : pub.createParentNodes(pub.parentIds),

  treeBox: null,  
  selection: null,  
  
  get rowCount()                     { return this.visibleData.length; },
  
  setTree: function(treeBox){
    this.treeBox = treeBox;
  },
  
  getCellText: function(idx, column) {
    if(this.visibleData[idx]) {
      if(column.id == "element") {
	return this.visibleData[idx].label;
      } else if (column.id == "url") {
        return pub.getUrlfromId(this.visibleData[idx].placeId);
      } else if (column.id == "date") {
        return pub.formatDate(pub.getFirstDatefromPid(this.visibleData[idx].placeId));
      }else {
        return "NotDefined";
      }
    }
  },
    
  isContainer: function(idx){
    if(this.visibleData[idx]){
      return this.visibleData[idx].isContainer;
    } else {
      return false;
    }
  },  
  isContainerOpen: function(idx)     { return this.visibleData[idx].isFolded; },  
  isContainerEmpty: function(idx)    { return false; },  
  isSeparator: function(idx)         { return false; },  
  isSorted: function()               { return false; },  
  isEditable: function(idx, column)  { return false; },  
  
  getParentIndex: function(idx) {  
    if (this.isContainer(idx)) return -1;  
    for (var t = idx - 1; t >= 0 ; t--) {  
      if (this.isContainer(t)) return t;  
    }
  },  
  getLevel: function(idx) {
    if(this.visibleData[idx]){
      return this.visibleData[idx].level;
    }
  },  
  hasNextSibling: function(idx, after) {  
    var thisLevel = this.getLevel(idx);  
    for (var t = after + 1; t < this.visibleData.length; t++) {  
      var nextLevel = this.getLevel(t);  
      if (nextLevel == thisLevel) return true;  
      if (nextLevel < thisLevel) break;  
    }  
    return false;  
  },
  
  //expand using the children cached in item, hopefully save expanding time
  expandFromNodeInTree: function(item, idx) {
    if (!item.children || item.children.length==0) {
      //alert(item);
      return 0;
    }
    // need to check here. Otherwise if check the children, the first parent won't be recorded as existInVisible.
    if(pub.existInVisible(item)){
      return 0;
    }
    item.isFolded = true;
    //alert("children\n" + item.children);
    for (var i = 0; i < item.children.length; i++) {  
      this.visibleData.splice(idx + i + 1, 0, item.children[i]);
    }
    // adjust the index offset of the node to expand
    var offset = 0;
    for (var i = 0; i < item.children.length; i++) {
      var child = item.children[i];
      offset += this.expandFromNodeInTree(child, idx+i+1+offset);
    }
    //only add the length of its own direct children, the children will count in the length of their own children themselves
    this.treeBox.rowCountChanged(idx + 1, item.children.length);
    return offset+item.children.length;
  },
  
  addSuspensionPoints: function(level, idx) {
    var sp = pub.ReferedHistoryNode(-1, -1, "searching...", false, false, [], level+1);
    this.visibleData.splice(idx+ 1, 0, sp);
    this.treeBox.rowCountChanged(idx + 1, 1);
  },
  delSuspensionPoints: function(idx) {
    this.visibleData.splice(idx+ 1, 1);
    this.treeBox.rowCountChanged(idx + 1, -1);
  },
  
  toggleOpenState: function(idx) {  
    var item = this.visibleData[idx];  
    if (!item.isContainer) return;  
  
    if (item.isFolded) {  
      item.isFolded = false;  
  
      var thisLevel = this.getLevel(idx);  
      var deletecount = 0;  
      for (var t = idx + 1;; t++) {
	//alert(t + ":" + this.getLevel(t) + " vs. " + thisLevel);
        if (this.visibleData[t] != null && (this.getLevel(t) > thisLevel)) deletecount++;  
        else break;  
      }  
      if (deletecount) {  
        this.visibleData.splice(idx + 1, deletecount);  
        this.treeBox.rowCountChanged(idx + 1, -deletecount);  
      }
    }  
    else {
      com.wuxuan.fromwheretowhere.sb.urlInit();
      pub.background.dispatch(new pub.workingThread(1, item, idx), pub.background.DISPATCH_NORMAL);
      this.addSuspensionPoints(item.level, idx);
      
    }  
    this.treeBox.invalidateRow(idx);  
  },  
  
  getImageSrc: function(idx, column) {},  
  getProgressMode : function(idx,column) {},  
  getCellValue: function(idx, column) {},  
  cycleHeader: function(col, elem) {},  
  selectionChanged: function() {},  
  cycleCell: function(idx, column) {},  
  performAction: function(action) {},  
  performActionOnCell: function(action, index, column) {},  
  getRowProperties: function(idx, column, prop) {},  
  
  getCellProperties: function(row,col,props){
    var pid = this.visibleData[row].placeId;
    var haveKeywords = pub.pidwithKeywords.indexOf(pid);
    var aserv=Components.classes["@mozilla.org/atom-service;1"].
                getService(Components.interfaces.nsIAtomService);
    //CAN'T alert here! 
    if(haveKeywords!=-1){
      props.AppendElement(aserv.getAtom("makeItBlue"));
    }
    if(pid==pub.retrievedId){
      props.AppendElement(aserv.getAtom("makeItRed"));
    }
    if(com.wuxuan.fromwheretowhere.sb.urls.indexOf(pub.getUrlfromId(this.visibleData[row].placeId))!=-1){
      props.AppendElement(aserv.getAtom("makeItCurve"));
    }
  },
  
  getColumnProperties: function(column, element, prop) {},
  click: function() {}
};  
  pub.selectNodeLocal = null;
  pub.showHasLocalCopy = function(){
    var localItem = document.getElementById("local");

    var node = this.treeView.visibleData[this.treeView.selection.currentIndex];
    var exists = com.wuxuan.fromwheretowhere.sb.urls.indexOf(pub.getUrlfromId(node.placeId));
    pub.selectNodeLocal = exists;
    localItem.hidden = (exists == -1);
  };
  
  pub.openlocal = function(){
    var uri = com.wuxuan.fromwheretowhere.sb.getLocalURIfromId(com.wuxuan.fromwheretowhere.sb.ids[pub.selectNodeLocal]);
    window.open(uri);
  };
  
  pub.openlink = function(){
    pub.getURLfromNode(pub.treeView);
  };
  
  pub.pidwithKeywords = [];
  
  pub.search = function() {
    pub.treeView.treeBox.rowCountChanged(0, -pub.treeView.visibleData.length);
    pub.treeView.addSuspensionPoints(-1, -1);
    //document.getElementById("elementList").disabled = "true";
    var keywords = document.getElementById("keywords").value;
    var words = pub.splitWithSpaces(keywords);
    var allpids = [];
    var allPpids = [];
    //TODO: new thread
    if(words.length==0){
      alert("no keywords input");
      //cancel "searching..." after "OK", and redisplay the former result      
      pub.treeView.delSuspensionPoints(-1);
      pub.treeView.treeBox.rowCountChanged(0, pub.treeView.visibleData.length);
      return;
    }
    // improve by search id from keywords directly instead of getting urls first
    allpids = pub.searchIdbyKeywords(words);
    pub.pidwithKeywords = [].concat(allpids);
    //alert(allpids.length + " pids:\n"+allpids);
    //getParentIds -> pIds, if exists in ids or pIds, don't add to parents
    //TODO: to be more precise. If there's an indirect link, it'll still pass
    for(var i=allpids.length-1;i>=0;i--){
      var pIds = pub.getParentIds(allpids[i]);
      //alert(pIds + " for " +allids[i]);
      if(!pIds || pIds.length==0){
	allPpids = pub.addInArrayNoDup(allpids[i], allPpids);
      } else {
	for(var j=0;j<pIds.length;j++){
	  var placeId = pub.getPlaceIdfromId(pIds[j]);
	  allPpids = pub.addInArrayNoDup(placeId, allPpids);
	}
      }
    }
    pub.treeView.delSuspensionPoints(-1);
    //alert(allPpids.length + " parent placeids: \n" + allPpids);
    //refresh tree, remove all visibledata and add new ones
    pub.treeView.visibleData = pub.createParentNodesCheckDup(allPpids, allpids);
    pub.treeView.treeBox.rowCountChanged(0, pub.treeView.visibleData.length);
    //document.getElementById("elementList").disabled = "false";
  };
  
  pub.keypress = function(event) {
    if(!event){
      alert("no event!");
      return;
    }
    var keyunicode=event.charCode || event.keyCode;
    if(keyunicode==13){
      pub.search();
    }
  };
  
  pub.init = function() {
    document.getElementById("elementList").view = pub.treeView;
    //document.getElementById("elementList").addEventListener("click", function (){getURLfromNode(treeView);}, false);
  }
  
  return pub;
}();
