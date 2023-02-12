import EventSystem.ColourPaletteColourChangeListener;

import javax.swing.*;
import java.awt.*;
import java.awt.event.*;
public class Window implements ActionListener {
    ColourPalette colorPicker;
    PopupMenus popupMenu;
    public Window() {
        popupMenu = new PopupMenus();
        createWindow();
    }

    private void createWindow() {
        JFrame frame = new JFrame("Picksel Majick");
        frame.setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);

        JPanel mainPanel = createMainPanel(); //Create new JPanel
        
        //Add Popupmenu
        popupMenu.createMainPopupMenu(frame);

        //Add mainPanel to the frame
        frame.add(mainPanel);
        //frame.pack() automatically sizes window based on sizes of components within the window.
        frame.pack();
        //Make frame visible
        frame.setVisible(true);
    }

    private JPanel createMainPanel() {
        JPanel mainPanel = new JPanel(); //Create new JPanel
        BorderLayout mainLayout = new BorderLayout(); //Create new border layout
        mainPanel.setLayout(mainLayout); //Assign border layout to JPanel

        //Create and add JPanels to each area in the mainPanel.
        JPanel northPanel = new JPanel();
        mainPanel.add(northPanel, BorderLayout.NORTH);
        JPanel eastPanel = new JPanel();
        mainPanel.add(eastPanel, BorderLayout.EAST);
        JPanel southPanel = new JPanel();
        mainPanel.add(southPanel, BorderLayout.SOUTH);
        JPanel westPanel = new JPanel();
        mainPanel.add(westPanel, BorderLayout.WEST);
        JPanel centerPanel = new JPanel();
        mainPanel.add(centerPanel, BorderLayout.CENTER);

        //Create toolbar
        JToolBar toolBar = createToolBar("Tools");
        //Add toolbar to desired panel
        northPanel.add(toolBar);

        //Create and add DrawingTools
        DrawingTools drawingTools = new DrawingTools();
        centerPanel.add(drawingTools);
    
        //Create colorPicker and add it
        colorPicker = new ColourPalette();
        eastPanel.add(colorPicker);
        //Add desired listeners to ColorPalette

        return mainPanel;
    }

    private JButton createNewButton(String name) //To assign action lisener all in one, use Object to parse in tool class
    {
        ActionableButton button = new ActionableButton(name);
        //button.addActionListener(new ActionListener());
        return button;
    }


    private JToolBar createToolBar(String name) {
        JToolBar toolBar = new JToolBar("Tools"); //Create a toolbar

        //Add the components
        toolBar.add(createButton("one", "This will activate drawing functionality"));
        toolBar.add(createButton("two", "This will activate eraser functionality"));
        toolBar.add(createButton("three", "This will activate shape drawing functionality"));

        //Return toolBar
        return toolBar;
    }
    private JButton createButton(String name, String tooltip) {
        JButton button = createNewButton(name);
        button.setToolTipText(tooltip);
        return button;
    } //Creates a JButton with the given name and sets its tooltip as provided tooltip string

    @Override
    public void actionPerformed(ActionEvent actionEvent) {
        Object source = actionEvent.getSource();
    }
}