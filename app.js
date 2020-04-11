var express=require('express');
var session = require('express-session');
var path=require('path');
var fs = require('fs');
var bodyParser = require('body-parser');
var urlencodedParser = bodyParser.urlencoded({ extended: false})
var dir=require('process').cwd();
var async = require('async');
var fileUpload=require('express-fileupload');
var underscore=require('underscore');
var fs = require('fs');

var app=express();
app.use(express.static(require('path').join(__dirname + '/public')));

app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

app.engine('ejs',require('ejs').renderFile);
app.set('view engine','ejs');

app.use(session({
  cookieName: 'session',
  secret: 'random_string_goes_here',
  duration:  10 * 1000,
  activeDuration: 10 * 1000
}));

app.get('/',function(req,res){
	res.render('start');
});

app.get('/combat',function(req,res){
	res.render('battle',{score:'', score2:'',winner:''});
});

app.post('/combat',urlencodedParser,async function(req,res){

        var handle_name = req.body.user1;
        var Twit =  require('twit');
		var config = require('./config')
		var T = new Twit(config);
		var battle_score=0;
		var score = 0;
		var flag=true;

		aggregate(req.body.user1);
		var userStrength1;
		function aggregate(handle_name){
			T.get('users/show',{screen_name:handle_name, include_entities : false}, function (err, data, response) {
			if(data.id){
				
				let friends_count = data.friends_count;
				let followers_count = data.followers_count;
				let created_at = data.created_at;
				let favourites_count = data.favourites_count;
				let verified = data.verified;
				let statuses_count = data.statuses_count;
				let elapsed_days = 1+Math.ceil((new Date().getTime() - new Date(created_at).getTime())/(1000*86400));
				    	
				//console.log(followers_count,friends_count,created_at,favourites_count,verified,statuses_count,elapsed_time);
				var basic_score = (statuses_count/elapsed_days) * ((1 + followers_count +  (favourites_count/(1+statuses_count)))/(1+friends_count));
				if(verified){
				    	let max_followers = 1200000000;
				    	basic_score = basic_score + (followers_count)/(max_followers);
				}
                
                var twitter_engagement;
                battle_score = basic_score;
                console.log("bs1",battle_score)
				T.get('statuses/user_timeline',{screen_name:handle_name, count : 200, trim_user : true}, function (err, data, response) {
					
					var tweets = data;
					var tweet_count = 0, retweet_count =0, reply_count = 0;
					var tc =0,rc=0,rec=0;
					var err = 0.0001
			        var days = 1+Math.ceil((new Date(tweets[0].created_at).getTime() - new Date(tweets[tweets.length-1].created_at).getTime())/(1000*86400));//for_recent_200_Tweets
					for(var i=0;i<tweets.length;i++){
						//console.log(tweets[i]);
						//console.log(tweets[i].created_at);
						//console.log(tweets[i].retweet_count, tweets[i].favorite_count);
						//console.log(tweets[i].text);
						if(tweets[i].retweeted_status!=null){
							retweet_count = retweet_count + err; rc=rc+1;
						}
						else if(tweets[i].in_reply_to_status_id!=null && tweets[i].in_reply_to_user_id != tweets[i].user.id){
							reply_count = reply_count + 1*(0.007*tweets[i].retweet_count + 0.003*tweets[i].favorite_count) + err; rec=rec+1;
						}
						else{
							tweet_count = tweet_count + 1*(0.007*tweets[i].retweet_count + 0.003*tweets[i].favorite_count) + err; tc=tc+1;
						}
					}
					console.log(tc,rc,rec);
					console.log(tweet_count,retweet_count,reply_count);
					//console.log("days",days);
                    twitter_engagement = (0.5*tweet_count + 0.3*retweet_count + 0.2*reply_count)/days; 
                    if(tweets.length<200){
                    	twitter_engagement = twitter_engagement * (tweets.length/200);
                    }
                    battle_score = battle_score + twitter_engagement;
                    console.log("te",twitter_engagement);
                    console.log("bs",battle_score);

                    T.get('followers/list', { screen_name: handle_name, skip_status : true, include_user_entities : false },  function (err, data, response) {
					
					var followers = data.users;
					for(var i=0; i<followers.length; i++){
						let followers_count = followers[i].followers_count;
				    	let friends_count = followers[i].friends_count;
				    	let created_at = followers[i].created_at;
				    	let favourites_count = followers[i].favourites_count;
				    	let verified = followers[i].verified;
				    	let statuses_count = followers[i].statuses_count;
				    	let elapsed_days = 1+Math.ceil((new Date().getTime() - new Date(created_at).getTime())/(1000*86400));
				    	//console.log(followers_count,friends_count,created_at,favourites_count,verified,statuses_count,elapsed_time)
				    	var fScore = (statuses_count/elapsed_days) * ((1 + followers_count +  (favourites_count/(1+statuses_count)))/(1+friends_count));
				    	if(verified){
				    		let max_followers = 1200000000;
				    		fScore = fScore + (followers_count)/(max_followers);
				    	}
				    	//console.log(fScore);
				    	battle_score = battle_score + (twitter_engagement*fScore);
					}
                    console.log("final ",battle_score);
                    
                    if(flag)
                    {
                    	 userStrength1=battle_score;
                    	 flag=false;
                    	 aggregate(req.body.user2);
                    }
                    else{
                    	var userStrength2 = battle_score;
                    	var winner;
                    	if(userStrength1 > userStrength2)
                    		winner = req.body.user1;
                    	else
                    		winner = req.body.user2;
                    	res.render('battle',{score : userStrength1.toFixed(5), score2 : userStrength2.toFixed(5), winner : "winner : " +winner});
                    }
                    
				    });
			    });
			}
			else{
				console.log("user not found");
				var flagRaiser;
				if(flag){
					flagRaiser = req.body.user1 + " does not exist";
					res.render('battle',{score : flagRaiser, score2 : '', winner : ''});
				}
				else{
					flagRaiser = req.body.user2 + " does not exist";
					res.render('battle',{score : '', score2 : flagRaiser, winner : ''});
				}
				
			}
		});
		}
		  
})

var async = require('async');
app.listen(8080);
console.log("server running at localhost:8080")