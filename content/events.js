com.wuxuan.fromwheretowhere.events = function(){
  var pub={};
  
  var lasttitle = "";
  var eventNum = 0;
  
  pub.recommendThread = function(threadID, doc) {
    this.threadID = threadID;
    this.doc = doc;
  };
  
  pub.recommendThread.prototype = {
    run: function() {
      try {
        var recLinks=[];
        //TODO: this.doc seems unnecessary??
        if (this.doc.nodeName == "#document") {
        //if (this.doc instanceof HTMLDocument) {
          // is this an inner frame?
          //TODO: defaultView can be null!
          if (this.doc.defaultView.frameElement) {
            // Frame within a tab was loaded.
            // Find the root document:
            while (this.doc.defaultView.frameElement) {
              this.doc = this.doc.defaultView.frameElement.ownerDocument;
            }
          }
        }
        var currentDoc = this.doc;//gBrowser.selectedBrowser.contentDocument;//pub.mainWindow.document;
        //only recommond for current page, and when it's loaded
        if(currentDoc == gBrowser.selectedBrowser.contentDocument && currentDoc.title!=lasttitle){
          lasttitle=currentDoc.title;
          recLinks = pub.recommend.recommendInThread(currentDoc);
        }
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
  
  pub.onPageLoad = function(event){
    //alert("page loaded");
    eventNum +=1;
    // this is the content document of the loaded page.
    var doc = event.originalTarget;
    pub.main.dispatch(new pub.recommendThread(1, doc), pub.main.DISPATCH_NORMAL);
  };
  
  //TODO: when current document is closed, the current suggestion should be closed too
  //pub.mainWindow.addEventListener("close", pub.closePanel, false);
  pub.main = Components.classes["@mozilla.org/thread-manager;1"].getService().mainThread;
    
  pub.mainWindow = window.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
      .getInterface(Components.interfaces.nsIWebNavigation)
      .QueryInterface(Components.interfaces.nsIDocShellTreeItem)
      .rootTreeItem
      .QueryInterface(Components.interfaces.nsIInterfaceRequestor)
      .getInterface(Components.interfaces.nsIDOMWindow);
  
  pub.getOtherMenuitem = function(ele){
    if(ele.getAttribute("id")==="recommend"){
      return document.getElementById("toolbar-recommend");
    }else{
      return document.getElementById("recommend");
    }
  };
  
  pub.toggleRecommend = function(event){
    //alert("in toggle");
    var rec = event.target;
    if (rec.getAttribute("checked")=="true"){
      pub.down();
      rec.removeAttribute("checked");
      //disable the other one
      var other = pub.getOtherMenuitem(rec);
      if(other)
        other.removeAttribute("checked");
    }
    else{
      pub.auto();
      rec.setAttribute("checked", "true");
      //enable the other one
      var other = pub.getOtherMenuitem(rec);
      if(other)
        other.setAttribute("checked", "true");
    }
  };
  
  pub.closePanel = function(event){
    var savePanel = document.getElementById("fwtwRelPanel");
    if(savePanel!=null){
      savePanel.hidePopup();
    } else{
      alert("no panel detected!");
    }
  };
  
  pub.toggleSugPanel = function(closeWhenOpen){
    var recPanel = document.getElementById("fwtwRelPanel");
    if(recPanel==null){
      pub.recommend.popUp("","",[],[]);
    }else{
      if(recPanel.state=="open" && closeWhenOpen){
        recPanel.hidePopup();
      }else{
        recPanel.openPopup(null, "start_end", 60, 80, false, false);
      }
    }
  };
  
  pub.init = function(){
    pub.recommend=com.wuxuan.fromwheretowhere.recommendation;
    pub.recommend.init();
    pub.toggleSugPanel(false);
  };
  
  pub.auto = function(){
    //TODO: document.? gbrowser.? difference?
    pub.mainWindow.addEventListener("DOMContentLoaded", pub.onPageLoad, false);
  }
  
  pub.down = function(){
    pub.mainWindow.removeEventListener("DOMContentLoaded", pub.onPageLoad, false);
  };
    
  return pub;
}();