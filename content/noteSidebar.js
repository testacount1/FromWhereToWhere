
com.wuxuan.fromwheretowhere.noteSidebar = function(){
  var pub={};
  
  pub.mainWindow = window.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
 .getInterface(Components.interfaces.nsIWebNavigation)
 .QueryInterface(Components.interfaces.nsIDocShellTreeItem)
 .rootTreeItem
 .QueryInterface(Components.interfaces.nsIInterfaceRequestor)
 .getInterface(Components.interfaces.nsIDOMWindow);
 
  pub.nativeJSON = Components.classes["@mozilla.org/dom/json;1"].createInstance(Components.interfaces.nsIJSON);
    
  pub.initView = function(){
    document.getElementById("recordList").view = pub.treeView;
  };
    
  pub.treeView = {
  // have to separate the looks of node from the content!!!!!!
  
    visibleData : function(){
      return com.wuxuan.fromwheretowhere.localmanager.queryAll();
    }(),
  
    treeBox: null,  
    selection: null,  
    
    get rowCount()                     { return this.visibleData.length; },
    
    setTree: function(treeBox){
      this.treeBox = treeBox;
    },
    
    getCellText: function(idx, column) {
      if(this.visibleData[idx]) {
        if(column.id == "title") {
          return this.visibleData[idx].name;
        } else if (column.id == "date") {
          return new Date(this.visibleData[idx].date);
        } else {
          return "NotDefined";
        }
      }
    },
      
    isContainer: function(idx){
      return false;
    },  
    isContainerOpen: function(idx)     { return false; },  
    isContainerEmpty: function(idx)    { return false; },  
    isSeparator: function(idx)         { return false; },  
    isSorted: function()               { return false; },  
    isEditable: function(idx, column)  { return false; },  
    
    getParentIndex: function(idx) {
      return -1;
    },  
    getLevel: function(idx) {
      return 0;
    },  
    
    addSuspensionPoints: function(level, idx) {
      var sp = pub.ReferedHistoryNode(-1, -1, "searching...", null, false, false, [], level+1);
      this.visibleData.splice(idx+ 1, 0, sp);
      this.treeBox.rowCountChanged(idx + 1, 1);
    },
    delSuspensionPoints: function(idx) {
      this.visibleData.splice(idx+ 1, 1);
      this.treeBox.rowCountChanged(idx + 1, -1);
    },
    
    toggleOpenState: function(idx) {   
    },  
    
    getImageSrc: function(idx, column) {
      //can't access .main like it's global
    },
    
    getProgressMode : function(idx,column) {},  
    getCellValue: function(idx, column) {},  
    cycleHeader: function(col, elem) {},  
    selectionChanged: function() {},  
    cycleCell: function(idx, column) {},  
    performAction: function(action) {},  
    performActionOnCell: function(action, index, column) {},  
    getRowProperties: function(idx, column, prop) {},  
    
    getCellProperties: function(row,col,props){
    },
    
    getColumnProperties: function(column, element, prop) {},
    click: function() {}
  };
  
  pub.showMenuItems = function(){
    var deleteItem = document.getElementById("delete");
    var node = pub.treeView.visibleData[pub.treeView.selection.currentIndex];
    deleteItem.hidden = (node==null);
  };
  
  pub.deleteNotes = function(){
    var recordIds = pub.treeView.selection.currentIndex;
    //alert("delete: "+recordIds)
    com.wuxuan.fromwheretowhere.localmanager.deleteRecords(recordIds);
    //rowCountChange for all ids
    //alert("remove row: "+recordIds)
    pub.treeView.visibleData.splice(recordIds, 1);
    pub.treeView.treeBox.rowCountChanged(recordIds, -1);
  }
  //TODO: merge the code with ImportNode in main
  pub.openNode = function(){
    //compliant issue: for 4.0
    var treeView = pub.mainWindow.content.document.getElementById("elementList").view;
    if(treeView==null){
      //for 3.6.x
      treeView = pub.mainWindow.content.document.getElementById("elementList").wrappedJSObject.view;
    }
    var json = com.wuxuan.fromwheretowhere.localmanager.getNodeContent(pub.treeView.visibleData[pub.treeView.selection.currentIndex].id);

    var newNodes = [];
    try{
      newNodes = pub.nativeJSON.decode(json);
    }catch(err){
      if(json && json!="[]"){
        alert("record corrupted:\n" + json + " " + err);
      }
    }
    Application.storage.set("fromwheretowhere.currentData", newNodes);
    //just to reset visibleData, seems this hack works
    treeView.setTree(null);
  };
  
  return pub;
}();