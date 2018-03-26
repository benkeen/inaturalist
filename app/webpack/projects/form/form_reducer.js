import _ from "lodash";
import inatjs from "inaturalistjs";
import Project from "../shared/models/project";
import piexif from "piexifjs";

const SET_ATTRIBUTES = "projects-form/project/SET_ATTRIBUTES";

export default function reducer( state = { }, action ) {
  switch ( action.type ) {
    case SET_ATTRIBUTES:
      return Object.assign( { }, state, action.attributes );
    default:
  }
  return state;
}

export function setAttributes( attributes ) {
  return {
    type: SET_ATTRIBUTES,
    attributes
  };
}

export function setProject( p ) {
  return setAttributes( { project: new Project( p ) } );
}


export function createNewProject( type ) {
  return ( dispatch, getState ) => {
    const config = getState( ).config;
    dispatch( setProject( {
      project_type: type,
      user_id: config.currentUser.id,
      admins: [{ user: config.currentUser, role: "manager" }]
    } ) );
    $( window ).scrollTop( 0 );
  };
}

export function loggedIn( state ) {
  return ( state && state.config && state.config.currentUser );
}

export function updateProject( attrs ) {
  return ( dispatch, getState ) => {
    const state = getState( );
    return dispatch( setAttributes( {
      project: new Project( Object.assign( { }, state.form.project, attrs ) )
    } ) );
  };
}

let titleValidationTimestamp = new Date( ).getTime( );
export function validateProjectTitle( ) {
  return ( dispatch, getState ) => {
    const project = getState( ).form.project;
    if ( !project ) { return null; }
    const searchParams = { title_exact: project.title, not_id: project.id, per_page: 1 };
    titleValidationTimestamp = new Date( ).getTime( );
    const timecheck = _.clone( titleValidationTimestamp );
    dispatch( updateProject( { titleError: false } ) );
    return setTimeout( ( ) => {
      if ( _.isEmpty( project.title ) ) {
        dispatch( updateProject( { titleError: "title is required" } ) );
        return;
      }
      if ( timecheck === titleValidationTimestamp ) {
        inatjs.projects.autocomplete( searchParams ).then( response => {
          if ( _.isEmpty( response.results ) ) {
            dispatch( updateProject( { titleError: false } ) );
          } else {
            dispatch( updateProject( { titleError: "title already taken" } ) );
          }
        } ).catch( e => console.log( e ) );
      } else {
        console.log( "duplicate" );
      }
    }, 250 );
  };
}

export function setTitle( title ) {
  return dispatch => {
    dispatch( updateProject( { title } ) );
    dispatch( validateProjectTitle( ) );
  };
}

export function addProjectRule( operator, operandType, operand ) {
  return ( dispatch, getState ) => {
    const project = getState( ).form.project;
    if ( !project || !operand ) { return; }
    const operandID = operandType ? operand.id : operand;


    const newRules = [];
    let ruleExists = false;
    _.each( project.project_observation_rules, rule => {
      const isMatch = (
        operator === rule.operator &&
        operandType === rule.operand_type &&
        operandID === rule.operand_id
      );
      if ( isMatch && rule._destroy ) {
        newRules.push( Object.assign( { }, rule, { _destroy: false } ) );
        ruleExists = true;
      } else {
        ruleExists = ruleExists || isMatch;
        newRules.push( rule );
      }
    } );
    if ( !ruleExists ) {
      const newRule = {
        operator,
        operand_type: operandType,
        operand_id: operandID
      };
      if ( operandType ) {
        const instanceName = operandType.toLowerCase( );
        newRule[instanceName] = operand;
      }
      newRules.push( newRule );
    }
    dispatch( updateProject( { project_observation_rules: newRules } ) );
  };
}

export function removeProjectRule( ruleToRemove ) {
  return ( dispatch, getState ) => {
    const project = getState( ).form.project;
    if ( !project || !ruleToRemove ) { return; }
    const newRules = [];
    _.each( project.project_observation_rules, rule => {
      if ( ( ruleToRemove.id && rule.id && ruleToRemove.id === rule.id ) ||
           ( ruleToRemove.operator === rule.operator &&
             ruleToRemove.operand_type === rule.operand_type &&
             ruleToRemove.operand_id === rule.operand_id ) ) {
        // if the rule already exists in the database, mark it as to be destroyed
        // otherwise, just leave the rule off new rule list
        if ( rule.id ) {
          newRules.push( Object.assign( { }, rule, { _destroy: true } ) );
        }
      } else {
        newRules.push( rule );
      }
    } );
    dispatch( updateProject( { project_observation_rules: newRules } ) );
  };
}

export function addManager( user ) {
  return ( dispatch, getState ) => {
    const project = getState( ).form.project;
    if ( !project || !user ) { return; }
    const newAdmins = [];
    let managerExists = false;
    _.each( project.admins, admin => {
      const isMatch = ( admin.user.id === user.id );
      if ( isMatch && admin._destroy ) {
        newAdmins.push( Object.assign( { }, admin, { _destroy: false } ) );
        managerExists = true;
      } else {
        managerExists = managerExists || isMatch;
        newAdmins.push( admin );
      }
    } );
    if ( !managerExists ) {
      newAdmins.push( { user, role: "manager" } );
    }
    dispatch( updateProject( { admins: newAdmins } ) );
  };
}

export function removeProjectUser( projectUser ) {
  return ( dispatch, getState ) => {
    const project = getState( ).form.project;
    if ( !project || !projectUser ) { return; }
    const newAdmins = [];
    _.each( project.admins, admin => {
      if ( projectUser.id && admin.id && projectUser.id === admin.id ) {
        newAdmins.push( Object.assign( { }, admin, { _destroy: true } ) );
      } else if ( projectUser.user.id !== admin.user.id ) {
        newAdmins.push( admin );
      }
    } );
    dispatch( updateProject( { admins: newAdmins } ) );
  };
}

export function setRulePreference( field, value ) {
  return ( dispatch, getState ) => {
    const project = getState( ).form.project;
    if ( !project || !field ) { return; }
    project.rule_preferences = _.reject( project.rule_preferences, pref => pref.field === field );
    project.rule_preferences.push( { field, value } );
    let dateType = project.date_type;
    if ( field === "observed_on" ) {
      dateType = "exact";
    } else if ( field === "d1" || field === "d2" ) {
      dateType = "range";
    }
    dispatch( updateProject( {
      rule_preferences: project.rule_preferences,
      date_type: dateType
    } ) );
  };
}

export function showError( e ) {
  return dispatch => {
    if ( e.response ) {
      e.response.text( ).then( text => ( text ? JSON.parse( text ) : text ) ).then( json => {
        console.log( json );
        alert( JSON.stringify( json.error.original ) );
      } );
    } else {
      alert( e );
    }
    dispatch( updateProject( { saving: false } ) );
  };
}


const readExif = ( droppedFile ) => {
  const reader = new FileReader();
  const metadata = { };
  return new Promise( ( resolve ) => {
    reader.onloadend = e => {
      const exif = { };
      // read EXIF into an object
      let exifObj;
      try {
        exifObj = piexif.load( e.target.result );
      } catch ( err ) {
        return resolve( metadata );
      }
      _.each( exifObj, ( tags, ifd ) => {
        if ( ifd === "thumbnail" ) { return; }
        _.each( tags, ( value, tag ) => {
          exif[piexif.TAGS[ifd][tag].name] = value;
        } );
      } );
      resolve( { width: exif.PixelXDimension, height: exif.PixelYDimension } );
    };
    reader.readAsDataURL( droppedFile );
  } );
};

export function onFileDrop( droppedFiles, field ) {
  return dispatch => {
    if ( _.isEmpty( droppedFiles ) ) { return; }
    const droppedFile = droppedFiles[0];
    readExif( droppedFile ).then( metadata => {
      console.log( metadata );
      if ( droppedFile.type.match( /^image\// ) ) {
        dispatch( updateProject( { [field]: droppedFile } ) );
      }
    } ).catch( e => {
      console.log( e );
    } );
  };
}

export function submitProject( ) {
  return ( dispatch, getState ) => {
    const state = getState( );
    const project = state.form.project;
    if ( !loggedIn( state ) || !project ) { return; }
    const payload = { project: {
      project_type: ( project.project_type === "umbrella" ) ? "umbrella" : "collection",
      user_id: project.user_id || state.config.currentUser.id,
      title: project.title,
      icon: project.droppedIcon ? project.droppedIcon : null,
      cover: project.droppedBanner ? project.droppedBanner : null,
      preferred_banner_color: project.banner_color,
      prefers_hide_title: project.hide_title,
      prefers_rule_quality_grade: project.rule_quality_grade ?
        _.keys( project.rule_quality_grade ).join( "," ) : "",
      prefers_rule_photos: _.isEmpty( project.rule_photos ) ? "" : project.rule_photos,
      prefers_rule_sounds: _.isEmpty( project.rule_sounds ) ? "" : project.rule_sounds,
      prefers_rule_observed_on:
        ( project.date_type !== "exact" || _.isEmpty( project.rule_observed_on ) ) ?
          "" : project.rule_observed_on,
      prefers_rule_d1: project.date_type !== "range" || _.isEmpty( project.rule_d1 ) ?
        "" : project.rule_d1,
      prefers_rule_d2: project.date_type !== "range" || _.isEmpty( project.rule_d2 ) ?
        "" : project.rule_d2
    } };
    if ( !payload.project.icon && project.iconDeleted ) {
      payload.icon_delete = true;
    }
    if ( !payload.project.cover && project.bannerDeleted ) {
      payload.cover_delete = true;
    }
    payload.project.project_observation_rules_attributes =
      payload.project.project_observation_rules_attributes || [];
    _.each( project.project_observation_rules, rule => {
      if ( ( project.project_type === "umbrella" && rule.operand_type === "Project" ) ||
           ( project.project_type !== "umbrella" &&
             ( rule.operand_type === "Taxon" ||
               rule.operand_type === "User" ||
               rule.operand_type === "Place" ) ) ) {
        const rulePayload = {
          operator: rule.operator,
          operand_type: rule.operand_type,
          operand_id: rule.operand_id
        };
        if ( rule.id ) {
          rulePayload.id = rule.id;
          rulePayload._destroy = !!rule._destroy;
        }
        payload.project.project_observation_rules_attributes.push( rulePayload );
      }
    } );
    payload.project.project_users_attributes =
      payload.project.project_users_attributes || [];
    _.each( project.admins, admin => {
      const projectUserPayload = {
        user_id: admin.user.id,
        role: admin.role
      };
      if ( admin.id ) {
        projectUserPayload.id = admin.id;
        projectUserPayload._destroy = !!admin._destroy;
      }
      payload.project.project_users_attributes.push( projectUserPayload );
    } );
    dispatch( updateProject( { saving: true } ) );
    if ( project.id ) {
      payload.id = project.slug;
      inatjs.projects.update( payload ).then( ( p ) => {
        window.location = `/projects/${p.slug}`;
      } ).catch( e => {
        dispatch( showError( e ) );
      } );
    } else {
      inatjs.projects.create( payload ).then( ( p ) => {
        window.location = `/projects/${p.slug}`;
      } ).catch( e => {
        dispatch( showError( e ) );
      } );
    }
  };
}