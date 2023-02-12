import javax.swing.*;
import java.awt.event.*;
public class PopupMenus implements ActionListener//Made a seperate class in case we want seperate popup menus
{
    JMenuItem cut,copy,paste;
    public void createMainPopupMenu(JFrame f) {
        JPopupMenu popupmenu = new JPopupMenu("Edit"); //Create new popup menu
        //Create menu items
        cut = new JMenuItem("Cut");
        copy = new JMenuItem("Copy");
        paste = new JMenuItem("Paste");
        //Add action listners
        cut.addActionListener(this);
        copy.addActionListener(this);
        paste.addActionListener(this);
        //Add menu items
        popupmenu.add(cut);
        popupmenu.add(copy);
        popupmenu.add(paste);

        f.addMouseListener(new MouseAdapter() {
            public void mouseClicked(MouseEvent e) { //If main panel was clicked
                if(SwingUtilities.isRightMouseButton(e)) { //If it was a right click
                    popupmenu.show(f, e.getX(), e.getY()); //Show the popup menu
                }
            }
        });
    }
    public void actionPerformed(ActionEvent e) {
        if(e.getSource()==cut){
            System.out.println("Cut activate!");
        }
        else if (e.getSource()==copy){
            System.out.println("Copy activate!");
        }
        else if (e.getSource()==paste){
            System.out.println("Paste activate!");
        }
    }
}
