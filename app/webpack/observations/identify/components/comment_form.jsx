import React from "react";
import PropTypes from "prop-types";
import { Button } from "react-bootstrap";
import INatTextArea from "./inat_text_area";

// The approach of getting the form values from the event object here is based
// on some feedback from DrMike in https://discord.gg/0ZcbPKXt5bZ6au5t. It's
// fine here, but it might be worth considering
// https://github.com/erikras/redux-form if this approach ends up getting
// complicated.

const CommentForm = ( { observation, onSubmitComment, className, key } ) => (
  <form
    key={ key }
    className={`CommentForm ${className}`}
    onSubmit={function ( e ) {
      e.preventDefault();
      onSubmitComment( {
        parent_type: "Observation",
        parent_id: observation.id,
        body: e.target.elements.body.value
      } );
      $( e.target.elements.body ).val( null );
    }}
  >
    <h3>{ I18n.t( "add_a_comment" ) }</h3>
    <INatTextArea name="body" className="form-control" elementKey={ `${key}-inat-text-area` } mentions />
    <Button type="submit" bsStyle="success">{ I18n.t( "save" ) }</Button>
  </form>
);

CommentForm.propTypes = {
  observation: PropTypes.object,
  onSubmitComment: PropTypes.func.isRequired,
  className: PropTypes.string,
  key: PropTypes.string
};

export default CommentForm;
