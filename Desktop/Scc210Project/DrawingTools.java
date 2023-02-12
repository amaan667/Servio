import javax.swing.*;

import EventSystem.ColourPaletteColourChangeListener;

import java.awt.*;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.security.PKCS12Attribute;

public class DrawingTools extends JPanel implements ActionListener {
    private JButton Clear;
    private JButton newCanvas;
    private JButton drawLine;
    private JButton drawRectangle;
    private JButton drawOval;
    private JButton eraser;
    private JButton save;
    private JButton text;
    private static JTextField strokeSize;
    private static int choice;
    private Color currentColor = Color.black;
    public DrawingTools()
    {
        //create the window add all buttons and fields
        this.setLayout(new GridLayout(4,2));
        newCanvas = new JButton("New Canvas");
        newCanvas.addActionListener(this);

        drawLine = new JButton("Line");
        drawLine.addActionListener(this);

        Clear = new JButton("Clear");
        Clear.addActionListener(this);

        drawRectangle = new JButton("Rectangle");
        drawRectangle.addActionListener(this);

        drawOval = new JButton("Oval");
        drawOval.addActionListener(this);

        eraser = new JButton("Eraser");
        eraser.addActionListener(this);

        save = new JButton("Save File");
        save.addActionListener(this);

        strokeSize = new JTextField("1", 3);

        text = new JButton("Text Input");
        text.addActionListener(this);

        this.add(newCanvas);
        this.add(drawLine);
        this.add(drawRectangle);
        this.add(drawOval);
        this.add(text);
        this.add(eraser);
        this.add(strokeSize);
        this.add(save);
        this.add(Clear);
        setVisible(true);

    }

    @Override
    public void actionPerformed(ActionEvent actionEvent) {
        if(actionEvent.getSource()==newCanvas)
        {
            String w=JOptionPane.showInputDialog(this,"Enter width");
            String h=JOptionPane.showInputDialog(this,"Enter height");
            int width = Integer.parseInt(w);
            int height = Integer.parseInt(h);

            DrawLine canvas = new DrawLine(width, height, currentColor);
            canvas.setVisible(true);
        }
        if(actionEvent.getSource()==drawLine)
        {
            choice = 0;
        }
        if(actionEvent.getSource()==drawRectangle)
        {
            choice = 1;
        }
        if(actionEvent.getSource()==eraser)
        {
            
            choice = 2;
        }
        if(actionEvent.getSource()==save)
        {
            FileSave save = new FileSave();
        }
        if(actionEvent.getSource()==drawOval)
        {
            choice = 3;
        }
        if(actionEvent.getSource()==text)
        {
            choice = 4;
        }
        if(actionEvent.getSource()==Clear)
        {
          
             choice =7;
            
        }

    }
    public static int getChoice()
    {
        return choice;
    }

    public static int getStrokeSize()
    {
        int x = Integer.parseInt(strokeSize.getText());
        return x;
    }
}

