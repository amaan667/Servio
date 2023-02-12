import java.awt.*;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.awt.geom.Line2D;
import java.awt.geom.Point2D;
import java.awt.geom.Rectangle2D;
import java.awt.geom.Ellipse2D;
import java.lang.Math;
//import java.awt.Graphics.clearRect;
import javax.swing.*;

public class DrawLine extends JFrame
{
	//Sample 01: Graphics2D Declaration
	Point2D.Float pt1 = new Point2D.Float(0.0f, 0.0f);
	Point2D.Float pt2 = new Point2D.Float(0.0f, 0.0f);
	JTextField strokeSize = new JTextField("1", 3);
	Color currentColour = Color.black;
	public DrawLine(int width, int height, Color initialColour) throws HeadlessException
	{
		//Sample 02: Set Size and Position
		setBounds(30, 30, width, height);
		Container ControlHost = getContentPane();
		ControlHost.setLayout(new FlowLayout());
		ControlHost.setBackground(Color.WHITE);

		//Set initial colour
		currentColour = initialColour;
		
		//Sample 03: Handle Mouse Events
		addMouseListener(new MouseAdapter() {
			@Override
			public void mousePressed(MouseEvent e) {
				pt1 = new Point2D.Float(e.getX(), e.getY());
			}
			@Override
			public void mouseReleased(MouseEvent e) {
				pt2 = new Point2D.Float(e.getX(), e.getY());
				repaint();
			}
		});
	}
	
	@Override
	public void paint(Graphics g)
	{
		Graphics2D g2d = (Graphics2D) g; 

		int x = DrawingTools.getStrokeSize();
		g2d.setStroke(new BasicStroke(x));
		g2d.setColor(currentColour);

		//code for choices of drawing tools
		//line drawing choice
		if(DrawingTools.getChoice()==0)
		{
			Line2D.Float line2D = new Line2D.Float(pt1, pt2);
			g2d.draw(line2D);
		}
		//rectangle drawing choice
		if(DrawingTools.getChoice()==1)
		{
			Float w = Math.abs(pt2.x-pt1.x);
			Float h = Math.abs(pt2.y-pt1.y);
			Float startX = checkNeg(pt2.x, pt1.x);
			Float startY = checkNeg(pt2.y, pt1.y);
			Rectangle2D.Float rect = new Rectangle2D.Float(startX, startY, w, h);
			g2d.draw(rect);
		}
		//eraser drawing choice
		if(DrawingTools.getChoice()==2)
		{
			g2d.setColor(getBackground());
			Line2D.Float line2D = new Line2D.Float(pt1, pt2);
			//g2d.clearRect(pt1,pt2,);
			g2d.draw(line2D);
		}
		
		
		//Oval drawing choice
		if(DrawingTools.getChoice()==3)
		{
			Float w = Math.abs(pt2.x-pt1.x);
			Float h = Math.abs(pt2.y-pt1.y);
			Float startX = checkNeg(pt2.x, pt1.x);
			Float startY = checkNeg(pt2.y, pt1.y);
			Ellipse2D.Float ellip = new Ellipse2D.Float(startX, startY, w, h);
			g2d.draw(ellip);
		}
		//Text input choice
		if(DrawingTools.getChoice()==4)
		{
			String text=JOptionPane.showInputDialog(this,"Enter Text");
			g2d.drawString(text, pt1.x, pt1.y);
		}
		if(DrawingTools.getChoice()==7){ 
			g.clearRect(0, 0, getWidth(), getHeight());
		}
	}

	public Float checkNeg(Float p2, Float p1)
	{
		if((p2-p1)<0)
		{
			return p2;
		}
		else
		{
			return p1;
		}
	}
}