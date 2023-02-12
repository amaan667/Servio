import javax.swing.*;
import java.awt.*;
import java.awt.event.*;
public class ActionableButton extends JButton {
    private String identifier;
    public ActionableButton(String givenName) {
        super(givenName); //Create button with specified name
        identifier = givenName;
    }

    public String getIdentifier() {
        return identifier;
    }
}
