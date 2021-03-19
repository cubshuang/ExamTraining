let dvSol=document.querySelector("#dvAnsSol");
let dvRet=document.querySelector("#dvAnsRet");
var nowQues={
    isMulti:false, btnType:'', myAns:'', myPreAns:'', QNo:0, selNo:-1,
    cleanQA:function(){
        dvSol.innerHTML="";
        dvRet.innerHTML="";
    },
    selectAns:function(){
        let QAlist=Array.from(document.querySelectorAll(".QAItem"));
        this.myAns=QAlist.map(item => (item.checked)?item.id.split('_')[1]:'').filter(ans=>ans!='');
        QAlist.forEach(item => {
            let id=item.id.split('_')[1];
            let aItem=document.querySelector("#ansItem_"+id);
            if (item.checked){
                aItem.classList.add("ansSelect");
            }else{
                aItem.classList.remove("ansSelect");
            }
        });
        this.myPreAns=nowQues.myAns;
        this.cleanQA();
    },
    errGetQA:function(){
        dvSol.innerHTML="";
        dvRet.innerHTML="取得題目有誤";
    }
}
var QA={
    arrQues:null, yourAns:null,
    getQuestion:function(num){
        try{
            nowQues.cleanQA();
            nowQues.QNo=arrQues.indexOf(num);
            let Question=exam[nowQues.QNo], Answer=Question.ansItem, QId=Question.id;
            nowQues.isMulti=(Question.answer.indexOf(',')>0);
            nowQues.btnType=(nowQues.isMulti)?"checkbox":"radio";
            nowQues.selNo=-1;
            //render questuon
            document.title=examName;
            document.querySelector(".dvQName").innerHTML=examName;
            document.querySelector(".dvQNo").innerHTML="<p>第 " + QId + " 題</p>";
            document.querySelector(".dvQues").innerHTML=Question.question;
            //render asnwer items
            let ansArea=document.querySelector(".dvAns");
            ansArea.innerHTML="";
            for(let i=0;i<Answer.length;i++){
                let AId=Answer[i].ans, ansDiv=document.createElement("div");
                ansDiv.innerHTML="<div class='ansItem' id='ansItem" + "_" + AId + "'>" + "<input type='" + nowQues.btnType + "' id='A_" + AId + "' name='Q_" + QId + "' class='QAItem'>" + AId+"." + "<div class='ansCont' id='C_" + AId + "'>" + Answer[i].item + "</div>" + "</div>";
                ansArea.appendChild(ansDiv);
            }
            //binding event
            document.querySelectorAll(".ansCont").forEach(item => {
                item.addEventListener("click",this.choiceMe);
            });
            document.querySelectorAll(".QAItem").forEach(item => {
                item.addEventListener("change",this.checkedMe);
            });
            }catch(e){
            console.log(e);
            }
    },
    getQuestionYearNo:function(YP){
        try{
            location.href=location.pathname+"?y="+YP.replace("-","&p=");
        }catch(e){
            console.log(e);
        }
    },
    //By change
    checkedMe:function(){
        nowQues.cleanQA();
        nowQues.selectAns();
    },
    //By Click Content
    choiceMe:function(){
        let item=document.querySelector("#A_"+this.id.split("_")[1]);
        item.checked=(nowQues.btnType=="checkbox")?!(item.checked):true;
        nowQues.selectAns();
    },
    //By Arrow 2 Choice
    selectMe:function(m){
        let QAlist=document.querySelectorAll(".QAItem");
        switch (nowQues.btnType){
            case "radio":
                let nowChoice=Array.from(QAlist).map(item => item.checked).indexOf(true);
                if( nowChoice<0 ){
                    nowChoice=(m>0)?0:QAlist.length-1;
                }else{
                    if((m>0 && nowChoice<QAlist.length-1) || (m<0 && nowChoice>0)){
                        nowChoice=nowChoice+m;
                    }
                }
                QAlist[nowChoice].checked=true;
                nowQues.selNo=nowChoice;
                break;
            case "checkbox":
                let nowSelect=nowQues.selNo;
                if( nowSelect<0 ){
                    nowSelect=(m>0)?0:QAlist.length-1;
                }else{
                    if((m>0 && nowSelect<QAlist.length-1) || (m<0 && nowSelect>0)){
                        nowSelect=nowSelect+m;
                    }
                }
                nowQues.selNo=nowSelect;
                let thisAnsCont=document.querySelectorAll(".ansCont");
                for(let i=0;i<thisAnsCont.length;i++){
                    if (i==nowQues.selNo){
                        thisAnsCont[i].classList.add("ansToSelect");
                    }else{
                        thisAnsCont[i].classList.remove("ansToSelect");
                    }
                }
                break;
        }
        nowQues.selectAns();
    },
    //By Arrow and Alt||Ctrl to Choice
    selectMe2:function(m){
        let QAlist=document.querySelectorAll(".QAItem");
        try {
            QAlist[nowQues.selNo].checked=!(QAlist[nowQues.selNo].checked);    
        } catch (error) {
        }
        nowQues.selectAns();
    },
    fnWatchAns:function(){
        let thisAns=exam[nowQues.QNo].answer.split(',');
        thisAns.forEach(id=>{ document.querySelector("#ansItem_"+id).classList.remove("ansCorrect"); });
        if (nowQues.myAns.length>0){
            dvSol.innerHTML="正確答案："+thisAns;
            if (exam[nowQues.QNo].answerMemo!=null){
                dvSol.innerHTML+=" 【"+exam[nowQues.QNo].answerMemo+"】";
            }
            dvRet.innerHTML=(nowQues.myAns.join(',')==thisAns)?"恭喜答對！":"答案錯誤！";
            thisAns.forEach(id=>{ document.querySelector("#ansItem_"+id).classList.add("ansCorrect"); });
        }else{
            dvSol.innerHTML="";
            dvRet.innerHTML="請選擇答案";
        }
    },
    fnQNext:function(){
       (nowQues.QNo<arrQues.length-1)?QA.getQuestion(arrQues[nowQues.QNo+1]):nowQues.errGetQA();
    },
    fnQPrevios:function(){
        (nowQues.QNo>0)?QA.getQuestion(arrQues[nowQues.QNo-1]):nowQues.errGetQA();
    },
    selectQANo:function(){
        QA.getQuestion(document.querySelector("#qaNo").value*1.0);
    },
    selectQAYP:function(){
        QA.getQuestionYearNo(document.querySelector("#qaYP").value);
    },
    ini:function(){
        yourAns=new Array();
        arrQues=new Array();
        let qaSelect=document.querySelector("#qaNo");
        try{
            for(let i=0;i<exam.length;i++){
                arrQues[i]=exam[i].id;
                let op=document.createElement("option");
                op.value=arrQues[i];
                op.text="第 " + (i+1).toString() + " 題";
                qaSelect.appendChild(op);
            }
            yourAns.length=exam.length;
            //this.getQuestion(arrQues[arrQues.length-1]);
            this.getQuestion(arrQues[0]);
            document.querySelector("#AnsWatch").addEventListener("click",this.fnWatchAns);
            document.querySelector("#QNext").addEventListener("click",this.fnQNext);
            document.querySelector("#QPrevious").addEventListener("click",this.fnQPrevios);
            document.querySelector("#qaNo").addEventListener("change",this.selectQANo);
        }catch(e){
            console.log(e.toString());
            dvRet.innerHTML=e.toString();
        }
        qaSelect=document.querySelector("#qaYP");
        try{
            for(let i=0;i<fName.length;i++){
                let s=fName[i].split("-");
                let op=document.createElement("option");
                op.value=fName[i];
                op.text=s[0] + " 年 【" + (s[1]=="2"?"內科":"通論") + "】";
                qaSelect.appendChild(op);
            }
            qaSelect.addEventListener("change",this.selectQAYP);
            let y = request("y"); y = (y!="") ? y:"109";
            let p = request("p"); p = (p!="") ? p:"1";
            qaSelect.value=y+"-"+p;
        }catch(e){
            console.log(e.toString());
            dvRet.innerHTML=e.toString();
        }
    }
}
QA.ini();
window.addEventListener('keydown', function(e){
    switch (e.keyCode || e.which ){
        case 37: QA.fnQPrevios();break;
        case 39: QA.fnQNext();break;
        case 13: QA.fnWatchAns();break;
        case 38: QA.selectMe(-1);break;
        case 40: QA.selectMe(1);break;
        case 17: case 18: QA.selectMe2();break;
    }
});
