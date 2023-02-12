import EventSystem.ToolbarButtonListener;

import javax.swing.*;
import java.awt.event.*;
import java.util.ArrayList;
import java.util.List;

public class Toolbar extends JToolBar implements ActionListener{
    private List<ToolbarButtonListener> toolbarButtonListeners = new ArrayList<ToolbarButtonListener>();
    public Toolbar() {
        super();
        setupToolbar("Toolbar");
    }
    private JButton createNewButton(String name) //To assign action lisener all in one, use Object to parse in tool class
    {
        ActionableButton button = new ActionableButton(name);
        button.addActionListener(this); //Adds listener to this toolbar
        return button;
    }


    private void setupToolbar(String name) {
        //Add the components
        super.add(createButton("one", "This will activate drawing functionality"));
        super.add(createButton("two", "This will activate eraser functionality"));
        super.add(createButton("three", "This will activate shape drawing functionality"));
    }
    private JButton createButton(String name, String tooltip) {
        JButton button = createNewButton(name);
        button.setToolTipText(tooltip);
        return button;
    } //Creates a JButton with the given name and sets its tooltip as provided tooltip string

    //Adds listener to the list
    public void addListener(ToolbarButtonListener toAdd) {
        toolbarButtonListeners.add(toAdd);
    }

    //Remove listener
    public void removeListener(ToolbarButtonListener toRemove) {
        toolbarButtonListeners.remove(toRemove);
    }

    private void notifyListeners(String identifier){
        for (int i = 0; i < toolbarButtonListeners.size(); i++) { //itereate through list
            toolbarButtonListeners.get(i).toolBarButtonPressed(identifier); //
        }
    }

    @Override
    public void actionPerformed(ActionEvent actionEvent) { //When button is pressed
        //get the identifier of the button
        String identifier = ((ActionableButton) actionEvent.getSource()).getIdentifier(); //Cast source to ActionableButton and use getIdentifier()
        //Notify all listeners of which button was pressed
        notifyListeners(identifier);
    }
}
