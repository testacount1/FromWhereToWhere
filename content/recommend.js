com.wuxuan.fromwheretowhere.recommendation = function(){
  var pub={};
  
  pub.recommend = function(title){
    var stopwords = com.wuxuan.fromwheretowhere.corpus.stopwords_en_NLTK;
    var allwords = title.split(" ");
    alert(allwords);
    for(var i=0; i<allwords.length; i++){
      allwords[i] = allwords[i].toLowerCase();
      if(stopwords.indexOf(allwords[i])>-1){
        allwords.splice(i, 1);
        i--;
      }
    }
    //alert(allwords);
    /*var savenote = document.getElementById("current_title");
    savenote.value = "title: "+allwords;
    document.getElementById("currentTitle").openPopup(null, "", 60, 50, false, false);
    */
    //document.commandDispatcher.focusedWindow.
    var links = document.commandDispatcher.focusedWindow.document.getElementsByTagNameNS("*", "a")
    var len = links.length;
    var alllinks = [];
    for(var i=0;i<len;i++){
      if(links[i]){
        alllinks.push(links[i].text);//links[i].href;
      }
    }
    alert(alllinks);
  };

  pub.init = function(){
    
  };
    
  return pub;
}();