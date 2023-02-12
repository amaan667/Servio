
import EventSystem.ActionListenerWithDataPackage;
import EventSystem.ColourPaletteColourChangeListener;
import EventSystem.ListenerMaintainer;

import javax.swing.*;
import javax.swing.event.ChangeEvent;
import javax.swing.event.ChangeListener;
import java.awt.*;
import java.util.List;

public class ColourPalette extends JColorChooser implements ChangeListener{
    //Create
    private ListenerMaintainer<ColourPaletteColourChangeListener> colourChangeListeners = new ListenerMaintainer();
    public ColourPalette() {
        super(); //Call JColorChooser constructor
        getSelectionModel().addChangeListener(this); //Add change listener to the getSelectionModel to get updates when changes to selected colour
    }

    //When the state changes get the new colour and notify listeners
    public void stateChanged(ChangeEvent e) {
        Color newColor = getColor();
        //Notify the listeners
        List<ColourPaletteColourChangeListener> listeners = colourChangeListeners.getList();
        for (int i = 0; i < listeners.size(); i++) { //itereate through list
            listeners.get(i).colourChanged(newColor);
        }
    }

    public void addListener(ColourPaletteColourChangeListener toAdd) {
        colourChangeListeners.addListener(toAdd);
    }

    public void removeListener(ColourPaletteColourChangeListener toRemove) {
        colourChangeListeners.removeListener(toRemove);
    }
}
