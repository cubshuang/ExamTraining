function ShowTime(){
    var now=new Date();
    var h=now.getHours();
    var m=now.getMinutes();
    var s=now.getSeconds();
    document.getElementById('showbox').innerHTML = h+' 時 '+m+' 分 '+ (s<10?"0":"") + s +'秒';
    if (s==0){
        train.checkTrain();
    }
    setTimeout('ShowTime()',1*1000); 
}
//火車函數
var train = {
    _trains_id : 0, //監控火車 流水id
    _trains : [],   //監控火車
    ini:function(){
        this.checkTrain();
        try {
            document.getElementById("s_station").innerHTML=station.start;
            document.getElementById("a_station").innerHTML=station.arrival;
            document.getElementById("e_station").innerHTML=station.end;
        } catch (error) {
            alert("車站名稱設定有誤");
        }
        
    },
    sortArray:function(obj){
        obj.sort(function(a, b) {
            return parseFloat(b.eTime.replace(':','')) - parseFloat(a.eTime.replace(':',''));
        });
    },
    sortTrain:function(){
        this.sortArray(this._trains);
		for (let i = 0; i < this._trains.length; i++) {
			if (this._trains[i]==null){
				this._trains.splice(i);
				console.log("remove empty")
				break;
			}	
		}
    },
    vsTime:function(tick){
        var now=new Date();
        var yy = now.getFullYear();
        var mm = now.getMonth()+1;
        var dd = now.getDate();
        var hh = now.getHours();
        var mi = now.getMinutes();
        //var ss = now.getSeconds();
        var tickYYYYMMDD =  yy.toString() + "-" + ((mm<10?"0":"") + mm.toString()) + "-" + ((dd<10?"0":"")+dd.toString());
        var tickTnow =  tickYYYYMMDD + 'T' + ((hh<10?"0":"") + hh.toString()) + ':' + ((mi<10?"0":"") + mi.toString()) + ':00';
        var tickTime =  tickYYYYMMDD + 'T' + tick + ':00';
        
        //  var t=(Date.parse(tickTime)).valueOf();
        //  var n=(Date.parse(tickTnow)).valueOf();
        //  var diff=(t-n)/ (1000 * 60 );
        //  console.log( tickTnow + '||' + tickTime  + '||' +  diff);
        //return parseInt(diff);
        return parseInt(((Date.parse(tickTime)).valueOf()-(Date.parse(tickTnow)).valueOf())/ (1000 * 60 ));
    },
    checkOnline:function(trainName){
        for	(var i =0;i<this._trains.length;i++){
            if (this._trains[i]!=null && this._trains[i].train==trainName){
                return true;
            }
        }
        return false;
    },
    checkTrain:function(){
        var mCnt=0;
        for	(var i =0;i<this._trains.length;i++){
            var t =this._trains[i];
            try{
                if (this.vsTime(t.eTime)<0){
                    var s= this._trains.splice(i,1);
                    console.log("remove : " + JSON.stringify(s));
                    mCnt+=1;
                }
            }catch(e){
                console.log(e);
            }
        }
        var demo=document.getElementById("demo");
        demo.innerHTML="";
        var trainName,sTime,eTime,aTime;
        for	(var i =0;i<GoN.length;i++){
            trainName = GoN[i][0];
            sTime=GoN[i][3];
            eTime=GoN[i][1];
            aTime=GoN[i][2];
            if (this.vsTime(sTime)<=0 && this.vsTime(eTime)>=0){
               //demo.innerHTML+=trainName + " " + sTime + " => " +  aTime +  " => " + eTime + "N<br>";
               if (this.checkOnline(trainName)==false){
                  this._trains[this._trains_id]={"id":this._trains_id,"dir":"N","sTime":sTime,"aTime":aTime,"eTime":eTime,"train":trainName};
                  this._trains_id+=1;
                  mCnt+=1;
                  this.sortTrain();
               }
            }
        }	
        for	(var i =0;i<GoS.length;i++){
            trainName = GoS[i][0];
            sTime=GoS[i][1];
            eTime=GoS[i][3];
            aTime=GoS[i][2];
            if (this.vsTime(sTime)<=0 && this.vsTime(eTime)>=0){
               //demo.innerHTML+=trainName + " " + sTime + " => " +  aTime +  " => " + eTime + "S<br>";
               if (this.checkOnline(trainName)==false){
                  this._trains[this._trains_id]={"id":this._trains_id,"dir":"S","sTime":sTime,"aTime":aTime,"eTime":eTime,"train":trainName};
                  this._trains_id+=1;
                  mCnt+=1;
                  this.sortTrain();
               }
            }
        }
        //console.log("SCAN後");
        this.sortTrain();
        if (mCnt>0){
            console.log("異動後" + new Date().toLocaleDateString() + ' ' +new Date().toLocaleTimeString());	
            //console.log(this._trains);
            console.log(JSON.stringify(this._trains));
        }

        //Paint Trains
        var pt=document.getElementById('showTrains');
        pt.innerHTML="";
        for (let k = 0; k < this._trains.length; k++) {
            const tr = this._trains[k];
            var dir,Time1,Time2,Time3;
            var TrainN="",TrainS="";
            var trKind="",trDir="", trPos="";
            dir=tr.dir;
            Time2=tr.aTime;
            if (dir=="N"){
                Time1=tr.eTime;
                Time3=tr.sTime;
                TrainS=tr.train;
            }else{
                Time1=tr.sTime;
                Time3=tr.eTime;
                TrainN=tr.train;
            }
            //順逆向
            trDir="Go2"+dir;
            //車種
            switch (tr.train.substring(0,2)) {
                case "區間":
                    trKind="_EMU800";
                    break;
                case "普悠":
                    trKind="_TEMU2000";
                    break;
                case "自強":
                    trKind="_E1000";
                    break;
                case "莒光":
                    trKind="_E200";
                    break;
                default:
                    trKind="_EMU700";
                    break;
            };
            //車輛目前位置
            //trPos="passN1";
            //console.log(JSON.stringify(tr));
            
            var posT=[this.vsTime(tr.sTime),this.vsTime(tr.aTime),this.vsTime(tr.eTime)];
            // console.log(this.vsTime(tr.aTime));
            // console.log(posT);
            //var posi=[this.vsTime(tr.sTime),this.vsTime(tr.aTime),this.vsTime(tr.eTime)];
            var posS=["","",""];
            posS[0]=(posT[0]>=0)?0:(posT[0]==-1)?1:(posT[0]>0)?3:2;
            posS[1]=(posT[1]==0)?1:(posT[1]==-1)?2:(posT[1]>0)?3:2;
            posS[2]=(posT[2]==0)?1:(posT[2]==-1)?2:(posT[2]>0)?3:2;
            // console.log(posT);
            // console.log(posS);
            
            if (posS[0]==0){
                trPos="stay" + dir + "0";
            }else if (posS[0]==1){
                trPos="pass" + dir + "1";
            }else if (posS[1]==1){
                trPos="pass" + dir + "2";    
            }else if (posS[2]==1){
                trPos="pass" + dir + "3";    
            }else{
                //stay
                if (posS[0]==2 && posS[1]>2){
                    trPos="stay" + dir + "1";
                }else if (posS[1]==2 && posS[2]>2){
                    trPos="stay" + dir + "2";
                }else{
                    trPos="stay" + dir + "3"; 
                }
            }

            // if (posi[0]==0){
            //     trPos="stay" + dir + "0";
            // }else if(posi[0]==-1){
            //     trPos="pass" + dir + "1";
            // }else if(posi[0]<=-1){

            //     trPos="stay" + dir + "1";
            // }
            
            // if(posi[1]==0){
            //     trPos="pass" + dir + "2";
            // }else if(posi[1]<=-1){
            //     trPos="stay" + dir + "2";
            // }else if(posi[2]==0){
            //     trPos="pass" + dir + "3";
            // }else if(posi[2]<=-1){
            //     trPos="stay" + dir + "3";
            // }
            console.log(dir + " @ " + tr.train  + " @ " + 
            this.vsTime(tr.sTime) + " @ " +
            this.vsTime(tr.aTime) + " @ " +
            this.vsTime(tr.eTime));
            var divTrain="<div class='test'>" +
                "<div class='row fs-5'>" +
                //"    <div class='col-sm-1 text-primary'>"+TrainN+"</div>" +
                "    <div class='col-sm-1'></div>" +
                "    <div class='col-sm-1 station'>"+Time1+"</div>" +
                "    <div class='col-sm-8 station stDiv'>"+
                "<span class='stNorth'>"+TrainN+"</span>"+Time2+
                "<span class='stSouth'>"+TrainS+"</span>"+"</div>" +
                "    <div class='col-sm-1 station'>"+Time3+"</div>" +
                "    <div class='col-sm-1'></div>" +
                //"    <div class='col-sm-1 text-primary'>"+TrainS+"</div>" +
                "</div>" +
                "<div class='row'>" +
                "    <div class='col-sm-12 trains'>" +
                // "        <div class='Train _TEMU2000 Go2N passN1'></div>" +
                "        <div class='Train " + trKind + " " + trDir + " " + trPos + "'></div>" +
                "    </div>" +
                "</div>" +
                "</div>";
                pt.innerHTML+=divTrain;
        }

        
    }	
};