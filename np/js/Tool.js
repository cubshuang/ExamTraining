function request(paras){ 
    var url = location.href; 
    var paraString = url.substring(url.indexOf("?")+1,url.length).split("&"); 
    var paraObj = {} 
    for (i=0; j=paraString[i]; i++){ 
        paraObj[j.substring(0,j.indexOf("=")).toLowerCase()] = j.substring(j.indexOf("=")+1,j.length); 
    } 
    var returnValue = paraObj[paras.toLowerCase()]; 
    if(typeof(returnValue)=="undefined"){ 
        return ""; 
    }else{ 
        return returnValue; 
    } 
}
var fName=["109-1","109-2","108-1","108-2","107-1","107-2","106-1","106-2","105-1","105-2","104-1","104-2","103-1","103-2","102-1","102-2","101-1"];//題目卷設定
let y = request("y"); y = (y!="") ? y:"109";
let p = request("p"); p = (p!="") ? p:"1";
let head = document.getElementsByTagName('head')[0]; 
let script1 = document.createElement('script'); 
let script2 = document.createElement('script'); 
let path = 'js/';
script1.type = script2.type= 'text/javascript'; 
script1.src = path + 'Exam-'+ y +'-'+ p +'.js'; 
script2.src = path + 'QA.js'; 
head.appendChild(script1).appendChild(script2);
