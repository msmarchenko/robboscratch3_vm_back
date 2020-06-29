const Cast = require('../util/cast');
const MathUtil = require('../util/math-util');
const Timer = require('../util/timer');
//const Robot_command = require('../robot/robot_command');
const Renderer = require('scratch-render');
const MOTORS_ON_DELTA = 50;
const DEGREE_RATIO = 5.19;

class Scratch3RobotBlocks {
    constructor (runtime) {
        /**
         * The runtime instantiating this block package.
         * @type {Runtime}
         */
        this.runtime = runtime;
    //    this.robot_command = new Robot_command();

        this.power_in_percent_left = 50;
        this.power_in_percent_right = 50;
      //  this.power = Math.round(this.power_in_percent* 0.63);
        this.power_left =   Math.round(this.power_in_percent_left * 0.63);
        this.power_right =  Math.round(this.power_in_percent_right * 0.63);
        this.motors_on_interval = null;
        this.motors_off_interval = null;
        this.need_to_stop = true; //false
        this.robot_direction = 'direction_forward';
        this.time = Date.now();
        this.motors_on_time_delta = null;

        this.motors_on_time1 = Date.now();
        this.motors_on_time2 = Date.now();

        this.motors_on_loop_need = null;

        this.robot_motors_on_for_seconds_timeout = null;
        this.robot_motors_on_for_seconds_timeout_stop = null;

        this.command_sent = false;

        this.a_command_unblock_interval = null;

        this.set_direction_block_step = 1;

        this.is_motors_on_active = false;

        this.time_sent1 = Date.now();
        this.time_sent2 = Date.now();
        this.time_sent3 = Date.now();

       this.robot_motors_on_for_seconds_end_timeout = null;


        this.runtime.RCA.registerRobotIsScratchduinoCallback(() => {

          this.power_left =  63;
          this.power_right =  63;

        });

        this.runtime.RCA.registerRobotIsRobboCallback(() => {

          this.power_left  =  Math.round(this.power_in_percent_left * 0.63);
          this.power_right =  Math.round(this.power_in_percent_right * 0.63);


        });
        this.sim_ac=true;
        this.kW=0.05; // шаг движения робота
        this.fps = 6; // Скорость обработки кадров инверсивно меняется 1000/5 = 200   = 72 клетки  =
        this.rad= 1000;// угол поворопа меняет
        this.xc= 0;
        this.yc=0;
        this.sim_dist_l=0;
        this.sim_dist_r=0;
        this.wall_color=[255,255,255];
        this.sim_pl = 63;
        this.sim_pr = 63;
        this.sim_int = null;
        this.distl=0;
        this.distr=0;
        this.minidist = 0;
        this.robot_delta_x=0;
        this.robot_delta_y=0;
        this.ddx =0;
        this.ddy = 0;
        this.ddp=[];  this.ddp[0]=0; this.ddp[1]=0; this.ddp[2]=0;
        this.ddd = []; this.ddd[0]=0;
        this.ddc = [];this.ddc[0]=1;this.ddc[1]=1;this.ddc[2]=1;this.ddc[3]=1;
        this.ddl = 0 ;
    }

    /**
     * Retrieve the block primitives implemented by this package.
     * @return {object.<string, Function>} Mapping of opcode to Function.
     */
    getPrimitives () {
        return {
            robot_motors_on_for_seconds: this.robot_motors_on_for_seconds,
            robot_motors_on: this.robot_motors_on,
            robot_motors_off:this.robot_motors_off,
            robot_set_direction_to:this.robot_set_direction_to,
            robot_set_motors_left_right_power_and_direction_separately:this.robot_set_motors_left_right_power_and_direction_separately,
            robot_get_sensor_data: this.robot_get_sensor_data,
            robot_motors_on_for_steps:this.robot_motors_on_for_steps,
            robot_turnright: this.robot_turnright,
            robot_turnleft: this.robot_turnleft,
            robot_set_motors_power:this.robot_set_motors_power,
            robot_set_motors_power_left_right_separately:this.robot_set_motors_power_left_right_separately,
            robot_start_button_pressed:this.robot_start_button_pressed,
            robot_turn_led_on:this.robot_turn_led_on,
            robot_turn_led_off:this.robot_turn_led_off,
            robot_claw_closed:this.robot_claw_closed,
            robot_claw_state:this.robot_claw_state,
            robot_reset_trip_meters: this.robot_reset_trip_meters,
            robot_get_rgb_sensor_data: this.robot_get_rgb_sensor_data,
            robot_is_current_color:this.robot_is_current_color,

            robot_set_sens:this.robot_set_sens,
            robot_get_dist:this.robot_get_dist,
            robot_touch:this.robot_touch,
            robot_wall_color:this.robot_wall_color
        };
    }

    getMonitored () {
        return {

        };
    }

  robot_motors_on_for_seconds (args, util) {
      clearTimeout(this.robot_motors_on_for_seconds_end_timeout);

       this.robot_motors_on_for_seconds_end_timeout = setTimeout(() => {
          this.runtime.RCA.setRobotPower(0,0,0);
       }, 40);

      this.is_motors_on_active = false;
      if (util.stackFrame.timer) {
          const timeElapsed = util.stackFrame.timer.timeElapsed();
          if (timeElapsed < util.stackFrame.duration * 1000) {
              util.yield();
          }
          else {
              if (!this.runtime.RCA.isRobotReadyToAcceptCommand()){
                  this.runtime.RCA.block_A_CommandQueue();
                  util.yield();
                  return;
              }
              else{
                  util.stackFrame.timer = undefined;
                  clearTimeout(this.sim_int);
                  clearTimeout(this.robot_motors_on_for_seconds_end_timeout);
                  this.runtime.RCA.setRobotPower(0,0,0);
                  this.runtime.RCA.unblock_A_CommandQueue();
              }
          }
      }
      else {
          if (!this.runtime.RCA.isRobotReadyToAcceptCommand()){
                  this.runtime.RCA.block_A_CommandQueue();
                  util.yield();
                  return;
          }
          util.stackFrame.timer = new Timer();
          util.stackFrame.timer.start();
          util.stackFrame.duration = Cast.toNumber(args.SECONDS);
          if(this.sim_ac){
              this.xc=util.target.x;
              this.yc=util.target.y;
              this.sim_int = setInterval(() => {
             const radians = MathUtil.degToRad(90 - util.target.direction);
             let dist = (this.sim_pl+this.sim_pr)/2*this.kW;
             this.sim_dist_l+=Math.abs(this.sim_pl*this.kW);
             this.sim_dist_r+=Math.abs(this.sim_pr*this.kW);
             const dx = dist * Math.cos(radians);
             const dy = dist * Math.sin(radians);
             this.yc+=dy;
             this.xc+=dx;
             util.target.setXY(this.xc, this.yc);
             if(util.target.isTouchingColor(this.wall_color)){
               this.yc-=dy;
               this.xc-=dx;
               util.target.setXY(this.xc, this.yc);
             }
             util.target.setDirection(util.target.direction + MathUtil.radToDeg(Math.atan((this.sim_pl-this.sim_pr)/this.rad)));
              }, this.fps);
          }
          if (util.stackFrame.duration <= 0) {
              return;
          }
          clearInterval(this.motors_on_interval);
          this.runtime.RCA.setRobotPower(this.power_left,this.power_right,0);
          this.runtime.RCA.unblock_A_CommandQueue();
          util.yield();
      }
  }

    robot_motors_on(args, util){

    //  console.trace("Trace: ");

    //  this.runtime.enableProfiling((frame) => {

    //         console.warn("frame: ");
    //         console.warn(frame);
    //     });

  this.xc=util.target.x;
  this.yc=util.target.y;
  const radians = MathUtil.degToRad(90 - util.target.direction);
  let dist = (this.sim_pl+this.sim_pr)/2*this.kW;
  const dx = dist * Math.cos(radians);
  const dy = dist * Math.sin(radians);
  this.yc+=dy;
  this.xc+=dx;
  util.target.setXY(this.xc, this.yc);

  clearInterval(this.sim_int);
  if(this.sim_ac){
    console.warn(util.target);
    console.warn(util.target.toJSON());
    this.sim_int = setInterval(() => {
      const radians = MathUtil.degToRad(90 - util.target.direction);
      let dist = (this.sim_pl+this.sim_pr)/2*this.kW;
      this.sim_dist_l+=Math.abs(this.sim_pl*this.kW);
      this.sim_dist_r+=Math.abs(this.sim_pr*this.kW);
      const dx = dist * Math.cos(radians);
      const dy = dist * Math.sin(radians);
      this.yc+=dy;
      this.xc+=dx;

      util.target.setXY(this.xc, this.yc);
      if(util.target.isTouchingColor(this.wall_color)){
        this.yc-=dy;
        this.xc-=dx;
        util.target.setXY(this.xc, this.yc);
      }
      util.target.setDirection(util.target.direction + MathUtil.radToDeg(Math.atan((this.sim_pl-this.sim_pr)/this.rad)));
      }, this.fps);
  }



      let power_left = this.power_left;
      let power_right = this.power_right;

      clearTimeout(this.robot_motors_on_for_seconds_timeout_stop);

      clearInterval(this.motors_off_interval);
      clearInterval(this.motors_on_interval);
      this.need_to_stop = false;

      this.is_motors_on_active = true;

      // this.motors_on_time2 = Date.now();

      // let motors_on_time_delta = this.motors_on_time2 - this.motors_on_time1;

      // console.log(`motors_on_time_delta: ${motors_on_time_delta}`);

      // if ((this.motors_on_time2 - this.motors_on_time1) <= MOTORS_ON_DELTA ){

      //       this.motors_on_loop_need = false;

      // }else{

      //       this.motors_on_loop_need = true;

      // }

      // this.motors_on_time1 = Date.now();


       this.motors_on_loop_need = true;

      /**
         We depends on hardware response time. This way we need to sync blocks runtime with hardware.
         So here we block "a command (which only returns telemetry)", sync block with hardware (with isRobotReadyToSendCommand()) and use only "c command (motion and telemetry)".
      **/

      //this.runtime.RCA.block_A_CommandQueue();


    //  console.log(`this.runtime.RCA.robot_motors_on(${power_left},${power_right})  Time: ${Date.now() - this.time}`);




       this.command_sent = false;

      if (this.runtime.RCA.isRobotReadyToAcceptCommand()){

           this.runtime.RCA.setRobotPower(this.power_left,this.power_right,0);
           this.command_sent = true;
          // this.time_sent1 = Date.now();
           this.runtime.RCA.unblock_A_CommandQueue();
           clearInterval(this.a_command_unblock_interval);



      }else{

         this.runtime.RCA.block_A_CommandQueue();

        //  if ( this.a_command_unblock_interval == null){

        //       this.a_command_unblock_interval = setInterval(() => {

        //         //if (this.command_sent){

        //           this.runtime.RCA.unblock_A_CommandQueue();
        //           clearInterval(this.a_command_unblock_interval);
        //           this.a_command_unblock_interval = null;

        //         //}
        //       },0);
        //   }

         util.yield();


      }

    // this.is_motors_on_active = true;
    // this.motors_on_interval =   setInterval((runtime,self) => {



    //   if (!self.need_to_stop){

    //     if (self.motors_on_loop_need){



    //       if (runtime.RCA.isRobotReadyToSendCommand()){

    //          runtime.RCA.setRobotPower(self.power_left,self.power_right,0);
    //         // console.log(`power_left: ${self.power_left} power_right: ${self.power_right}`);
    //          this.command_sent = true;
    //          this.runtime.RCA.unblock_A_CommandQueue();
    //          this.time_sent1 = Date.now();

    //       }else{

    //           this.runtime.RCA.block_A_CommandQueue();
    //           this.command_sent = false;

    //       }

    //     }



    //   }else{

    //        runtime.RCA.setRobotPower(0,0,0);

    //   }


    // }, 0,this.runtime,this);

    }

    robot_motors_off(args, util){

    // console.log(`Robot stop!`);

  // setTimeout(function(runtime,self){
  //
  //     console.log(`Robot send power stop!`);
  //
  //    runtime.RCA.setRobotPower(0,0,0);
  //
  // },0,this.runtime,this);

    //  this.runtime.RCA.setRobotPower(0,0,0);


    //  this.time_sent2 = Date.now();

     // console.log(`motors on_off delta: ${this.time_sent2 - this.time_sent1}`);



      clearInterval(this.sim_int);
      clearInterval(this.motors_on_interval);
      clearInterval(this.motors_off_interval);

      this.need_to_stop = true;

      this.is_motors_on_active = false;


    if (this.runtime.RCA.isRobotReadyToAcceptCommand()){

          //console.log(`Robot stop!`);

           this.runtime.RCA.setRobotPower(0,0,0);
           this.command_sent = true;
          // this.time_sent3 = Date.now();
          // console.log(`motors on_off delta after power: ${this.time_sent3 - this.time_sent1}`);
           this.runtime.RCA.unblockPowerCommand();
           this.runtime.RCA.unblock_A_CommandQueue();
           clearInterval(this.a_command_unblock_interval);



      }else{

         this.runtime.RCA.block_A_CommandQueue();
         this.runtime.RCA.blockPowerCommand();

         util.yield();


      }


     // this.runtime.RCA.setRobotPower(0,0,0);

     // this.runtime.RCA.unblock_A_CommandQueue();

      //  this.time_sent3 = Date.now();

      // console.log(`motors on_off delta after power: ${this.time_sent3 - this.time_sent1}`);

      // this.time_sent2 = Date.now();

      // console.log(`motors on_off delta: ${this.time_sent2 - this.time_sent1}`);

      // this.motors_off_interval =   setInterval(function(runtime,self){
      //
      //   if (self.need_to_stop){
      //
      //
      //       runtime.RCA.setRobotPower(0,0,0);
      //   }
      //
      //
      // }, 0,this.runtime,this);


    }


    update_power_using_direction(direction){

      switch (direction) {

        case "direction_forward":

          //  this.power = Math.round(this.power_in_percent * 0.63);
            this.power_left   =   Math.round(this.power_in_percent_left * 0.63);
            this.power_right  =   Math.round(this.power_in_percent_right * 0.63);
            this.sim_pl=Math.round(this.power_in_percent_left * 0.63);
            this.sim_pr=Math.round(this.power_in_percent_right * 0.63);
          break;

          case "direction_backward":

          //  this.power = Math.round(this.power_in_percent * 0.63) + 64;
            this.power_left   =   Math.round(this.power_in_percent_left * 0.63) +  64;
            this.power_right  =   Math.round(this.power_in_percent_right * 0.63) +  64;
            this.sim_pl=-Math.round(this.power_in_percent_left * 0.63);
            this.sim_pr=-Math.round(this.power_in_percent_right * 0.63);
          break;

          case "direction_left":

          //  this.power = Math.round(this.power_in_percent * 0.63);
            this.power_left     =   Math.round(this.power_in_percent_left * 0.63) +  64;
            this.power_right    =   Math.round(this.power_in_percent_right * 0.63);
            this.sim_pl=-Math.round(this.power_in_percent_left * 0.63);
            this.sim_pr=Math.round(this.power_in_percent_right * 0.63);
          break;

          case "direction_right":

          //  this.power = Math.round(this.power_in_percent * 0.63);
            this.power_left   =   Math.round(this.power_in_percent_left * 0.63);
            this.power_right  =   Math.round(this.power_in_percent_right * 0.63) +  64;
            this.sim_pl=Math.round(this.power_in_percent_left * 0.63);
            this.sim_pr=-Math.round(this.power_in_percent_right * 0.63);
          break;

        default:

      }



    }


    robot_set_direction_to(args, util){


          this.time_sent1 = Date.now();
          this.time_sent3 = this.time_sent1 - this.time_sent2;
          this.time_sent2 = Date.now();


           this.robot_direction = args.ROBOT_DIRECTION;

            this.update_power_using_direction(this.robot_direction);

            if (this.is_motors_on_active){

                if (this.runtime.RCA.isRobotReadyToAcceptCommand()){


                   this.activate_robot_power();
                   this.runtime.RCA.unblock_A_CommandQueue();


                  }else{
                    this.runtime.RCA.block_A_CommandQueue();
                    util.yield();
                  }

            }


    }


    activate_robot_power(){

        this.runtime.RCA.setRobotPower(this.power_left,this.power_right,0);

    }
    robot_touch(util,a)
    {
      if(this.minidist==0){
      var radians = MathUtil.degToRad(90 - util.target.direction);
      if(a==3 || a==2)
      radians = MathUtil.degToRad(90 - util.target.direction+180);
      const new_rad = MathUtil.degToRad(90 - util.target.direction+angle);
      this.ddx = 1 * Math.cos(radians);
      this.ddy = 1 * Math.sin(radians);
      this.robot_delta_x = delta * Math.cos(new_rad);
      this.robot_delta_y = delta * Math.sin(new_rad);
      this.ddp = [];this.ddp[0]=util.target.x; this.ddp[1]=util.target.y; this.ddp[2]=0;
      this.ddd = []; this.ddd[0]=util.target.renderer._allDrawables[0];
      this.ddc = [];this.ddc[0]=1;this.ddc[1]=1;this.ddc[2]=1;this.ddc[3]=1;
      this.ddl= [];
      }
      if(this.minidist!=5)
      {
        this.ddp[0]=Math.round(util.target.x+this.ddx*this.minidist+this.robot_delta_x);
        this.ddp[1]=Math.round(util.target.y+this.ddy*this.minidist+this.robot_delta_y);
        this.ddl = Renderer.getColor(this.ddp,this.ddd[0],this.ddc);
      if(this.ddl[0]==this.wall_color[0]&&this.ddl[1]==this.wall_color[1]&&this.ddl[2]==this.wall_color[2])
      {
        let a = this.minidist;
        this.minidist=0;
        return 100;
      }
      this.minidist++;
      }
      else {
        this.minidist=0;
        return 0;
      }
      console.warn("dist: "+this.minidist + "\n color " + this.ddl[0]+ " " + this.ddl[1]+ " " + this.ddl[2]+ "mesto"+ this.ddp[0]+" "+this.ddp[1]);
      util.yield();
    }
    robot_get_dist(util,a,angle,delta)
    {
            if(this.minidist==0){
            var radians = MathUtil.degToRad(90 - util.target.direction);
            if(a==3 || a==2)
            radians = MathUtil.degToRad(90 - util.target.direction+180);
            const new_rad = MathUtil.degToRad(90 - util.target.direction+angle);
            this.ddx = 1 * Math.cos(radians);
            this.ddy = 1 * Math.sin(radians);
            this.robot_delta_x = delta * Math.cos(new_rad);
            this.robot_delta_y = delta * Math.sin(new_rad);
            this.ddp = [];this.ddp[0]=util.target.x; this.ddp[1]=util.target.y; this.ddp[2]=0;
            this.ddd = []; this.ddd[0]=util.target.renderer._allDrawables[0];
            this.ddc = [];this.ddc[0]=1;this.ddc[1]=1;this.ddc[2]=1;this.ddc[3]=1;
            this.ddl= [];
            }
            if(this.minidist!=255)
            {
              this.ddp[0]=Math.round(util.target.x+this.ddx*this.minidist+this.robot_delta_x);
              this.ddp[1]=Math.round(util.target.y+this.ddy*this.minidist+this.robot_delta_y);
              this.ddl = Renderer.getColor(this.ddp,this.ddd[0],this.ddc);
            if(this.ddl[0]==this.wall_color[0]&&this.ddl[1]==this.wall_color[1]&&this.ddl[2]==this.wall_color[2])
            {
              let a = this.minidist;
              this.minidist=0;
              return a;
            }
            this.minidist++;
            }
            else {
              this.minidist=0;
              return -1;
            }
            console.warn("dist: "+this.minidist + "\n color " + this.ddl[0]+ " " + this.ddl[1]+ " " + this.ddl[2]+ "mesto"+ this.ddp[0]+" "+this.ddp[1]);
            util.yield();
    }
    robot_set_sens(util,a)
    {
      console.log("robot set sens"+ a + "sens list"+ this.runtime.sens_list[a]);
      var radians=0,dx=0,dy=0;
      const delta = 10;
      var ang = 0;
      if(a==1)ang=315;else if(a==2)ang=225;else if (a==3)ang=135;else if(a==4)ang=45;
      switch(this.runtime.sens_list[a])//"nosensor","line","led","light","touch","proximity","ultrasonic","color"
      {
      case "nosensor":
          return -1;
      break;
      case "line":
      console.log("line");
          var p=[];
          radians = MathUtil.degToRad(90 - util.target.direction+ang);
          dx = delta * Math.cos(radians);
          dy = delta * Math.sin(radians);
          p[0]=util.target.x+dx; p[1]=util.target.y+dy; p[2]=0;
          var d = []; d[0]=util.target.renderer._allDrawables[0];
          var c = [];c[0]=1;c[1]=1;c[2]=1;c[3]=1;
          var l= [];
          l = Renderer.getColor(p,d[0],c);
          sensor_data= Math.round(l[0]+l[1]+l[2])/3;
          console.log(sensor_data);
          return sensor_data;
      break;
      case "led":
        return -1;
      break;
      case "color":
          var p=[];
          radians = MathUtil.degToRad(90 - util.target.direction+ang);
          dx = delta * Math.cos(radians);
          dy = delta * Math.sin(radians);
          p[0]=util.target.x+dx; p[1]=util.target.y+dy; p[2]=0;
          var d = []; d[0]=util.target.renderer._allDrawables[0];
          var c = [];c[0]=1;c[1]=1;c[2]=1;c[3]=1;
          var l= [];
          l = Renderer.getColor(p,d[0],c);
          return l;
      break;
      case "touch":
      return this.robot_touch(util,a);
      break;
      case "proximity":
      return 255-this.robot_get_dist(util,ang,delta);
      break;
      case "ultrasonic":
      return this.robot_get_dist(util,a,ang,delta);
      break;
      case "light":
      var p=[];p[0]=util.target.x; p[1]=util.target.y; p[2]=0;
      var d = []; d[0]=util.target.renderer._allDrawables[0];
      var c = [];c[0]=1;c[1]=1;c[2]=1;c[3]=1;
      var l= [];
      l = Renderer.getColor(p,d[0],c);
      sensor_data=255 - Math.round(l[0]+l[1]+l[2])/3;
      return sensor_data;
      break;
      default:
      console.log("WTF");
      break;
      }
    }


    robot_get_sensor_data(args, util){

          console.log(`robot_get_sensor_data`);

          var sensor = args.ROBOT_SENSORS;
          var sensor_data = null;

          switch (sensor) {
            case "sensor1":

            //  console.warn("VM"+this.runtime.sens_list[0]);
              if(this.sim_ac){
              sensor_data = this.robot_set_sens(util,0);
              }
              else
              sensor_data = this.runtime.RCA.getSensorData(0);
              break;

           case "sensor2":

           if(this.sim_ac){
           sensor_data = this.robot_set_sens(util,1);
           }
           else
           sensor_data = this.runtime.RCA.getSensorData(0);
           break;

          case "sensor3":

          if(this.sim_ac){
          sensor_data = this.robot_set_sens(util,2);
          }
          else
          sensor_data = this.runtime.RCA.getSensorData(0);
          break;

          case "sensor4":

          if(this.sim_ac){
          sensor_data = this.robot_set_sens(util,3);
          }
          else
          sensor_data = this.runtime.RCA.getSensorData(0);
          break;

         case "sensor5":

         if(this.sim_ac){
         sensor_data = this.robot_set_sens(util,4);
         }
         else
         sensor_data = this.runtime.RCA.getSensorData(0);
         break;

        case "sensor_trip_meter_left":
              if(this.sim_ac)
              sensor_data = this.sim_dist_l;
              else
              sensor_data = this.runtime.RCA.getLeftPath();

            break;

        case "sensor_trip_meter_right":
              if(this.sim_ac)
              sensor_data = this.sim_dist_r;
              else
              sensor_data = this.runtime.RCA.getRightPath();

            break;



            default:

            sensor_data = -1;

          }

      return sensor_data;

    }

    robot_get_rgb_sensor_data(args,util){

      //    console.log(`robot_get_rgb_sensor_data   sensor: ${args.ROBOT_SENSORS_FOR_RGB} color: ${args.RGB_VALUES} `);

          let sensor_id = Number(args.ROBOT_SENSORS_FOR_RGB.replace("sensor","")) - 1;

          let rgb_array = this.runtime.RCA.getColorCorrectedRawValues(sensor_id);
          if(this.sim_ac){
        var p=[];  p[0]=util.target.x; p[1]=util.target.y; p[2]=0;
        var d = []; d[0]=util.target.renderer._allDrawables[0];
        var c = [];c[0]=1;c[1]=1;c[2]=1;c[3]=1;
        var l= [];
        l = Renderer.getColor(p,d[0],c);
  //      console.warn("result is"+l);
        switch (args.RGB_VALUES) {

          case "red":

                return l[0];

            break;

        case "green":

                return l[1];

          break;

        case "blue":

                  return l[2];

            break;

          default:

                return -1; // TODO: правильно обрабатывать

        }

      }
      else
          switch (args.RGB_VALUES) {

            case "red":

                  return rgb_array[0];

              break;

          case "green":

                  return rgb_array[1];

            break;

          case "blue":

                    return rgb_array[2];

              break;

            default:

                  return -1; // TODO: правильно обрабатывать

          }


    }
    robot_is_current_color(args){

    //   console.log(`robot_is_current_color   sensor: ${args.ROBOT_SENSORS_FOR_RGB} color: ${args.COLORS} `);

       let sensor_id = Number(args.ROBOT_SENSORS_FOR_RGB.replace("sensor","")) - 1;

       let color = args.COLORS;

       let current_color = this.runtime.RCA.colorFilter(sensor_id,true);

       if ((color == "unknown") && (Array.isArray(current_color))){

          return true;

       }else if (color == current_color){

           return true;

       }else{

         return false;

       }

    }

    check_value_out_of_range(value,low,high){

        return (value > high)?high:((value < low)?low:value);

    }

    robot_set_motors_left_right_power_and_direction_separately(args, util){

                     // this.runtime.RCA.setRobotPower(0,0,0);
    this.power_in_percent_left  =   (args.POWER_LEFT > 100)?100:((args.POWER_LEFT < 0)?0:args.POWER_LEFT);
    this.power_in_percent_right =   (args.POWER_RIGHT > 100)?100:((args.POWER_RIGHT < 0)?0:args.POWER_RIGHT);

    var robot_left_motor_direction = args.ROBOT_LEFT_MOTOR_DIRECTION;

    switch (robot_left_motor_direction) {

      case "direction_forward":


          this.power_left   =   Math.round(this.power_in_percent_left * 0.63);


        break;

        case "direction_backward":


          this.power_left   =   Math.round(this.power_in_percent_left * 0.63) +  64;
          this.sim_pl=-Math.round(this.power_in_percent_left * 0.63);

        break;


      default:

    }

    var robot_right_motor_direction = args.ROBOT_RIGHT_MOTOR_DIRECTION;

    switch (robot_right_motor_direction) {

      case "direction_forward":


          this.power_right   =   Math.round(this.power_in_percent_right * 0.63);
          this.sim_pr=Math.round(this.power_in_percent_right * 0.63);

        break;

      case "direction_backward":


          this.power_right   =   Math.round(this.power_in_percent_right * 0.63) +  64;
          this.sim_pr=-Math.round(this.power_in_percent_right * 0.63);

        break;


      default:

    }

     if (this.is_motors_on_active){

                if (this.runtime.RCA.isRobotReadyToAcceptCommand()){


                   this.activate_robot_power();
                   this.runtime.RCA.unblock_A_CommandQueue();


                  }else{

                    this.runtime.RCA.block_A_CommandQueue();
                    util.yield();


                  }

            }


    }


    check_65535(steps){

          return (steps > 65535)?65535:((steps < 0)?0:steps);

    }

    calculate_steps_delta(){

        let leftPath = this.runtime.RCA.getLeftPath();
        let rightPath = this.runtime.RCA.getRightPath();

        return  ((leftPath > rightPath)?leftPath:rightPath )  - this.stepsInitValue;



      //  return  this.runtime.RCA.getLeftPath()  - this.stepsInitValue; // TODO: проверить на 65535

    }

    calculate_steps_delta_left(){



            return  this.runtime.RCA.getLeftPath()  - this.stepsInitValueLeft; // TODO: проверить на 65535

    }

    calculate_steps_delta_right(){



      return  this.runtime.RCA.getRightPath()  - this.stepsInitValueRight; // TODO: проверить на 65535

    }

    robot_motors_on_for_steps(args, util){
    this.is_motors_on_active = false;

      clearTimeout(this.robot_motors_on_for_seconds_timeout_stop);

      if ((util.stackFrame.steps != null) && (typeof(util.stackFrame.steps) != 'undefined') ) {

        var stepsDeltaLeft  =  this.calculate_steps_delta_left();
        var stepsDeltaRight =  this.calculate_steps_delta_right();

        if ((stepsDeltaLeft < util.stackFrame.steps  ) && (stepsDeltaRight < util.stackFrame.steps) && (!this.need_to_stop) && (this.distl<Number(args.STEPS) && this.distr<Number(args.STEPS))) {  // TODO: сделать корректную проверку для робота без энкодеров

          // console.warn(`robot_motors_on_for_steps steps: ${util.stackFrame.steps} stepsDeltaLeft: ${stepsDeltaLeft} stepsDeltaRight: ${stepsDeltaRight}`);

            util.yield();

          } else{


            //   console.warn(`robot_motors_on_for_steps  exit function steps: ${util.stackFrame.steps} stepsDeltaLeft: ${stepsDeltaLeft} stepsDeltaRight: ${stepsDeltaRight}`);

                util.stackFrame.steps = null;
                clearInterval(this.sim_int);
                this.distl=0;
                this.distr=0;
                //this.need_to_stop = true; //for robot_set_direction_to //modified_by_Yaroslav


          }
      } else {


            clearInterval(this.motors_on_interval);
            clearInterval(this.sim_int);
            if (!this.runtime.RCA.isRobotReadyToAcceptCommand()){

                // console.warn(`robot_motors_on_for_steps not ready to accept command`);
                this.runtime.RCA.block_A_CommandQueue();
                util.yield();
                return;

            }else{

               this.runtime.RCA.unblock_A_CommandQueue();

            }

          //console.error(`robot_motors_on_for_steps 1`);


          util.stackFrame.steps = this.check_65535(args.STEPS);

          this.stepsInitValueLeft  =  this.runtime.RCA.getLeftPath();
          this.stepsInitValueRight =  this.runtime.RCA.getRightPath();


          if (util.stackFrame.steps <= 0) {

              return;
          }

          // console.log(`robot_motors_on_for_steps 2`);

          this.need_to_stop = false;
          this.runtime.RCA.setRobotPowerAndStepLimits(this.power_left,this.power_right,util.stackFrame.steps,0);
          clearInterval(this.sim_int);
          this.xc=util.target.x;
          this.yc=util.target.y;
                this.distl=0;
                this.distr=0;
          if(this.sim_ac){
            this.sim_int = setInterval(() => {
             const radians = MathUtil.degToRad(90 - util.target.direction);
             let dist = (this.sim_pl+this.sim_pr)/2*this.kW;
             this.sim_dist_l+=Math.abs(this.sim_pl*this.kW);
             this.sim_dist_r+=Math.abs(this.sim_pr*this.kW);
             this.distl+=Math.abs(this.sim_pl*this.kW);
             this.distr+=Math.abs(this.sim_pr*this.kW);
             const dx = dist * Math.cos(radians);
             const dy = dist * Math.sin(radians);
             this.yc+=dy;
             this.xc+=dx;
             util.target.setXY(this.xc, this.yc);
             if(util.target.isTouchingColor(this.wall_color)){
               this.yc-=dy;
               this.xc-=dx;
               util.target.setXY(this.xc, this.yc);
             }
             util.target.setDirection(util.target.direction + MathUtil.radToDeg(Math.atan((this.sim_pl-this.sim_pr)/this.rad)));
              }, this.fps);
          }



          util.yield();
      }




    }

    robot_turnright(args, util){

    this.is_motors_on_active = false;

    clearTimeout(this.robot_motors_on_for_seconds_timeout_stop);


    if ((util.stackFrame.steps != null) && (typeof(util.stackFrame.steps) != 'undefined')) {

      //  const stepsDelta =  this.calculate_steps_delta();

      var stepsDeltaLeft  =  this.calculate_steps_delta_left();
      var stepsDeltaRight =  this.calculate_steps_delta_right();

      if (  (stepsDeltaLeft < util.stackFrame.steps  ) && (stepsDeltaRight < util.stackFrame.steps)  && (!this.need_to_stop)&& (this.distl<Number(args.DEGREES)/230*100 && this.distr<Number(args.DEGREES)/230*100) ) { // TODO: сделать корректную проверку для робота без энкодеров

      //      console.log(`robot_turnright stepsDeltaLeft: ${stepsDeltaLeft} stepsDeltaRight: ${stepsDeltaRight}`);


        //  util.stackFrame.steps_counter++;

          util.yield();

        } else{

          //    console.log(`robot_turnright exit function stepsDeltaLeft: ${stepsDeltaLeft} stepsDeltaRight: ${stepsDeltaRight}`);
            clearInterval(this.sim_int);
              util.stackFrame.steps = null;

              //this.need_to_stop = true; //for robot_set_direction_to //modified_by_Yaroslav

        }
    } else {


           if (!this.runtime.RCA.isRobotReadyToAcceptCommand()){

                this.runtime.RCA.block_A_CommandQueue();
                util.yield();
                return;

            }else{

               this.runtime.RCA.unblock_A_CommandQueue();

            }

        util.stackFrame.steps = this.check_65535(Math.round(args.DEGREES / DEGREE_RATIO))
        this.stepsInitValueLeft  =  this.runtime.RCA.getLeftPath();
        this.stepsInitValueRight =  this.runtime.RCA.getRightPath();
      //  util.stackFrame.steps_counter = 0;

        clearInterval(this.sim_int);
        clearInterval(this.motors_on_interval);
        // //  clearInterval(this.motors_off_interval);
      //  this.runtime.RCA.setRobotPower(0,0,0);

        if (util.stackFrame.steps <= 0) {

            return;
        }



        let power_left =   Math.round(30 * 0.63);
        let power_right =  Math.round(30 * 0.63) + 64;
        clearInterval(this.sim_int);
        this.sim_pl=30;
        this.sim_pr=-30;

              this.distl=0;
              this.distr=0;
        if(this.sim_ac){
            this.xc=util.target.x;
            this.yc=util.target.y;
          this.sim_int = setInterval(() => {
           const radians = MathUtil.degToRad(90 - util.target.direction);
           let dist = (this.sim_pl+this.sim_pr)/2*this.kW;
           this.sim_dist_l+=Math.abs(this.sim_pl*this.kW);
           this.sim_dist_r+=Math.abs(this.sim_pr*this.kW);

           this.distl+=Math.abs(this.sim_pl*this.kW);
           this.distr+=Math.abs(this.sim_pr*this.kW);
           const dx = dist * Math.cos(radians);
           const dy = dist * Math.sin(radians);
           this.yc+=dy;
           this.xc+=dx;
           util.target.setXY(this.xc, this.yc);
           util.target.setDirection(util.target.direction + MathUtil.radToDeg(Math.atan((this.sim_pl-this.sim_pr)/this.rad)));
            }, this.fps);
        }
        this.runtime.RCA.setRobotPowerAndStepLimits(power_left,power_right, util.stackFrame.steps ,0);
        this.need_to_stop = false;
        util.yield();
    }


    }

    robot_turnleft(args, util){

          //   clearInterval(this.motors_on_interval);
          // //  clearInterval(this.motors_off_interval);
          //  this.runtime.RCA.setRobotPower(0,0,0);
          //
          // var steps = this.check_65535(Math.round(args.DEGREES / DEGREE_RATIO));
          //
          // if (steps != 0){
          //
          // let power_left =   Math.round(30 * 0.63) + 64;
          // let power_right =  Math.round(30 * 0.63);
          //
          // this.runtime.RCA.setRobotPowerAndStepLimits(power_left,power_right,steps,0);
          //
          // }

          this.is_motors_on_active = false;

          clearTimeout(this.robot_motors_on_for_seconds_timeout_stop);


          if ((util.stackFrame.steps != null) && (typeof(util.stackFrame.steps) != 'undefined') ) {

            //  const stepsDelta =  this.calculate_steps_delta();

            var stepsDeltaLeft  =  this.calculate_steps_delta_left();
            var stepsDeltaRight =  this.calculate_steps_delta_right();

            if (  (stepsDeltaLeft < util.stackFrame.steps  ) && (stepsDeltaRight < util.stackFrame.steps)  && (!this.need_to_stop)&& (this.distl<Number(args.DEGREES)/230*100 && this.distr<Number(args.DEGREES)/230*100)  ) { // TODO: сделать корректную проверку для робота без энкодеров

            //      console.log(`robot_turnleft stepsDeltaLeft: ${stepsDeltaLeft} stepsDeltaRight: ${stepsDeltaRight}`);


              //  util.stackFrame.steps_counter++;

                util.yield();

              } else{

              //      console.log(`robot_turnleft exit function stepsDeltaLeft: ${stepsDeltaLeft} stepsDeltaRight: ${stepsDeltaRight}`);
                    clearInterval(this.sim_int);
                    util.stackFrame.steps = null;

                    //this.need_to_stop = true; //for robot_set_direction_to //modified_by_Yaroslav

              }
          } else {

              if (!this.runtime.RCA.isRobotReadyToAcceptCommand()){

                this.runtime.RCA.block_A_CommandQueue();
                util.yield();
                return;

              }else{

               this.runtime.RCA.unblock_A_CommandQueue();

              }
              clearInterval(this.sim_int);
              util.stackFrame.steps = this.check_65535(Math.round(args.DEGREES / DEGREE_RATIO))
              this.stepsInitValueLeft  =  this.runtime.RCA.getLeftPath();
              this.stepsInitValueRight =  this.runtime.RCA.getRightPath();
            //  util.stackFrame.steps_counter = 0;


              clearInterval(this.motors_on_interval);
              // //  clearInterval(this.motors_off_interval);
            //  this.runtime.RCA.setRobotPower(0,0,0);

              if (util.stackFrame.steps <= 0) {

                  return;
              }



              let power_left =   Math.round(30 * 0.63) + 64;
              let power_right =  Math.round(30 * 0.63);
              clearInterval(this.sim_int);
              this.sim_pl=-30;
              this.sim_pr=30;

                    this.distl=0;
                    this.distr=0;
              if(this.sim_ac){
                  this.xc=util.target.x;
                  this.yc=util.target.y;
                this.sim_int = setInterval(() => {
                 const radians = MathUtil.degToRad(90 - util.target.direction);
                 let dist = (this.sim_pl+this.sim_pr)/2*this.kW;
                 this.sim_dist_l+=Math.abs(this.sim_pl*this.kW);
                 this.sim_dist_r+=Math.abs(this.sim_pr*this.kW);
                 this.distl+=Math.abs(this.sim_pl*this.kW);
                 this.distr+=Math.abs(this.sim_pr*this.kW);
                 const dx = dist * Math.cos(radians);
                 const dy = dist * Math.sin(radians);
                 this.yc+=dy;
                 this.xc+=dx;
                 util.target.setXY(this.xc, this.yc);
                 util.target.setDirection(util.target.direction + MathUtil.radToDeg(Math.atan((this.sim_pl-this.sim_pr)/this.rad)));
                  }, this.fps);
              }
              this.runtime.RCA.setRobotPowerAndStepLimits(power_left,power_right, util.stackFrame.steps ,0);
              this.need_to_stop = false;
              util.yield();
          }

    }

    robot_set_motors_power(args, util){

      //this.runtime.RCA.setRobotPower(0,0,0);

      let power = this.check_value_out_of_range(args.POWER,0,100);

        this.power_in_percent_left    =   power;
        this.power_in_percent_right   =   power;

    //  console.log(`robot_set_motors_power power_in_percent_left: ${this.power_in_percent_left} power_in_percent_right: ${this.power_in_percent_right}`);

        this.update_power_using_direction(this.robot_direction);

         if (this.is_motors_on_active){

                if (this.runtime.RCA.isRobotReadyToAcceptCommand()){


                   this.activate_robot_power();
                   this.runtime.RCA.unblock_A_CommandQueue();


                  }else{

                    this.runtime.RCA.block_A_CommandQueue();
                    util.yield();


                  }

            }


    }

    robot_set_motors_power_left_right_separately(args, util){

                   //   this.runtime.RCA.setRobotPower(0,0,0);
      this.power_in_percent_left    =   this.check_value_out_of_range(args.POWER_LEFT,0,100);
      this.power_in_percent_right   =   this.check_value_out_of_range(args.POWER_RIGHT,0,100);

    //  console.log(`robot_set_motors_power_left_right_separately power_in_percent_left: ${this.power_in_percent_left} power_in_percent_right: ${this.power_in_percent_right}`);

      this.update_power_using_direction(this.robot_direction);

       if (this.is_motors_on_active){

                if (this.runtime.RCA.isRobotReadyToAcceptCommand()){


                   this.activate_robot_power();
                   this.runtime.RCA.unblock_A_CommandQueue();


                  }else{

                    this.runtime.RCA.block_A_CommandQueue();
                    util.yield();


                  }

            }


    }

    robot_start_button_pressed(args, util){

        return (this.runtime.RCA.getButtonStartPushed() == 'true')?true:false;

    }

    robot_turn_led_on(args, util){

    //   console.log(`robot_turn_led_on led_position: ${args.ROBOT_POSITION}`);

       if (!this.runtime.RCA.isRobotReadyToAcceptCommand()){

              this.runtime.RCA.block_A_CommandQueue();  //not ready right now
              util.yield();
              return;


        }


        //here we ready

        this.runtime.RCA.unblock_A_CommandQueue();

       switch (args.ROBOT_POSITION) {

         case 'position1':

                  this.runtime.RCA.turnLedOn(0,0);

           break;

          case 'position2':

                  this.runtime.RCA.turnLedOn(1,0);

             break;

          case 'position3':

                  this.runtime.RCA.turnLedOn(2,0);

            break;

          case 'position4':

                  this.runtime.RCA.turnLedOn(3,0);

            break;

        case 'position5':

                  this.runtime.RCA.turnLedOn(4,0);

         break;

         default:

       }

    }

    robot_turn_led_off(args, util){

    //  console.log(`robot_turn_led_off led_position: ${args.ROBOT_POSITION}`);

      if (!this.runtime.RCA.isRobotReadyToAcceptCommand()){

              this.runtime.RCA.block_A_CommandQueue();  //not ready right now
              util.yield();
              return;


        }


        //here we ready

      switch (args.ROBOT_POSITION) {

        case 'position1':

                 this.runtime.RCA.turnLedOff(0,0);

          break;

         case 'position2':

                 this.runtime.RCA.turnLedOff(1,0);

            break;

         case 'position3':

                 this.runtime.RCA.turnLedOff(2,0);

           break;

         case 'position4':

                 this.runtime.RCA.turnLedOff(3,0);

           break;

       case 'position5':

                 this.runtime.RCA.turnLedOff(4,0);

        break;

        default:

      }

      this.runtime.RCA.unblock_A_CommandQueue();


    }

    robot_reset_trip_meters(args, util){

      if(this.sim_ac)
      {this.sim_dist_l=0;
      this.sim_dist_r=0;}
      this.runtime.RCA.resetTripMeters();

    }

    robot_claw_closed(args, util){

  //    console.log(`robot_claw_closed degrees: ${args.CLAW_CLOSED_PERCENT}`);

        var degrees = this.check_value_out_of_range(args.CLAW_CLOSED_PERCENT,0,100);

        if (!this.runtime.RCA.isRobotReadyToAcceptCommand()){

              this.runtime.RCA.block_A_CommandQueue();  //not ready right now
              util.yield();
              return;


        }


        //here we ready
         this.runtime.RCA.setClawDegrees(degrees,0);

        this.runtime.RCA.unblock_A_CommandQueue();

    }

    robot_claw_state(args, util){

    //    console.log(`robot_claw_state state: ${args.CLAW_STATES}`);

       if (!this.runtime.RCA.isRobotReadyToAcceptCommand()){

              this.runtime.RCA.block_A_CommandQueue();  //not ready right now
              util.yield();
              return;


        }


        //here we ready

        switch (args.CLAW_STATES) {

          case 'claw_open':

            this.runtime.RCA.setClawDegrees(0,0);

            break;

          case 'claw_half_open':

              this.runtime.RCA.setClawDegrees(50,0);

              break;

          case 'claw_closed':

              this.runtime.RCA.setClawDegrees(100,0);

              break;

          default:

        }

        this.runtime.RCA.unblock_A_CommandQueue();



    }
    robot_wall_color(args)
    {
      console.warn("WAS");
      console.warn(this.wall_color);
      const maskColor = Cast.toRgbColorList(args.COLOR);
      this.wall_color[0] = Cast.toNumber(maskColor[0]);
        this.wall_color[1] = Cast.toNumber(maskColor[1]);
          this.wall_color[2] = Cast.toNumber(maskColor[2]);
          console.warn("NOW");
            console.warn(this.wall_color);
    }

    }

    module.exports = Scratch3RobotBlocks;
